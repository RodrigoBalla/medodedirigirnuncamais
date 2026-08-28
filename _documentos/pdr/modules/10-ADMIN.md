# Módulo 10 — Admin Panel

> Painel pra fundador, CS, suporte técnico operarem a plataforma. Acesso gated por `profiles.is_admin = true`.

## Páginas

```
/admin/users                — todos usuários
/admin/users/:id            — detalhe do aluno (jornada + histórico CS)
/admin/organizations        — todas orgs
/admin/organizations/:id    — detalhe da org
/admin/journeys             — todas jornadas (filtro: travadas, novas, concluídas)
/admin/journeys/:id         — gerenciar jornada (gerar, editar tasks, mover gates)
/admin/content              — projects + lessons + accelerators
/admin/content/projects     — CRUD de trilhas
/admin/content/lessons      — listar + processar aulas
/admin/calls                — calendário de calls + sessões
/admin/community            — moderação de posts
/admin/metrics              — dashboard
/admin/audit-log            — log de ações sensíveis
```

## Capacidades especiais

### Impersonate ("Logar como")

Botão "Logar como" em qualquer aluno na lista. Edge function `admin-impersonate` gera magic link e redireciona admin pra interface logada como o aluno.

⚠️ **Sempre logar em `admin_audit_log`**.

```typescript
// Edge function
serve(async (req) => {
  const { user_id } = await req.json();
  const requesterId = await getUserIdFromJWT(req);
  
  const { data: requester } = await admin.from('profiles').select('is_admin').eq('id', requesterId).single();
  if (!requester?.is_admin) return new Response('Forbidden', { status: 403 });
  
  const { data: target } = await admin.from('profiles').select('email').eq('id', user_id).single();
  const { data: { properties } } = await admin.auth.admin.generateLink({ type: 'magiclink', email: target.email });
  
  await admin.from('admin_audit_log').insert({
    admin_id: requesterId, action: 'impersonate', target_user_id: user_id
  });
  
  return new Response(JSON.stringify({ login_url: properties.action_link }));
});
```

### Gerar Jornada (alunos antigos)

Botão "Gerar Jornada" pra orgs sem journey v3 ou com journey antiga. Cria journey + dispara `generateV3Missions`.

Atenção: a auto-geração também roda quando aluno acessa `/minha-jornada` se journey tem <6 missions. Por isso o botão admin é opcional.

### Edição em massa

- Adicionar mesmo acelerador em várias jornadas
- Atualizar deadline de várias missions
- Marcar tasks de várias jornadas como completas (caso edge: bug retroativo)

### Override de gates

Desbloquear etapa pra aluno específico. Útil quando aluno precisa de exceção.

```sql
UPDATE missions SET completed_at = NOW() WHERE id = ?;
-- ou
UPDATE missions SET deadline = '2026-12-31' WHERE id = ?; -- mais tempo
```

## Schemas adicionais

### `admin_audit_log`

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_user_id UUID,
  target_org_id UUID,
  target_resource TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_target ON admin_audit_log(target_user_id, created_at DESC);
```

Logar: impersonate, mudança de plano, edição manual de RLS, exclusão de dados, override de gate.

### `cs_assignments`

CS responsável por uma org:

```sql
CREATE TABLE cs_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cs_user_id UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);
```

### `cs_interactions`

Histórico de cada interação CS:

```sql
CREATE TABLE cs_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'checkin', -- 'onboarding', 'checkin', 'mentoria', 'access', 'alert'
  completed BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Métricas — dashboard

### Painel principal

- **Alunos ativos** (acesso nos últimos 7 dias)
- **Taxa de execução** (% que completou meta de 30 dias)
- **Travamentos** (alunos sem progresso há 5+ dias)
- **Vitórias registradas** (no canal wins ou em `user_victories`)
- **NPS** (se você fizer pesquisa)

### Filtros

- Por período (hoje, 7d, 30d, 90d)
- Por org / plano
- Por CS responsável
- Por etapa atual da jornada

### Queries úteis

```sql
-- Alunos travados há 5+ dias
SELECT u.email, p.full_name, m.title AS current_mission, m.started_at
FROM auth.users u
JOIN profiles p ON p.id = u.id
JOIN organization_members om ON om.user_id = u.id AND om.status = 'active'
JOIN user_journeys uj ON uj.organization_id = om.organization_id AND uj.is_active = true
JOIN missions m ON m.journey_id = uj.id AND m.started_at IS NOT NULL AND m.completed_at IS NULL
WHERE m.started_at < NOW() - INTERVAL '5 days'
  AND NOT EXISTS (SELECT 1 FROM cs_interactions WHERE organization_id = om.organization_id AND created_at > NOW() - INTERVAL '7 days');

-- Taxa de execução do mês
SELECT 
  COUNT(*) FILTER (WHERE phase = 'production') AS concluidas,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE phase = 'production') * 100.0 / NULLIF(COUNT(*), 0) AS taxa
FROM user_journeys
WHERE started_at > NOW() - INTERVAL '30 days';
```

## Componente "ImpersonateButton"

```tsx
function ImpersonateButton({ userId }: { userId: string }) {
  const handleImpersonate = async () => {
    const { data } = await supabase.functions.invoke('admin-impersonate', { body: { user_id: userId } });
    window.open(data.login_url, '_blank');
  };
  
  return <Button onClick={handleImpersonate}>Logar como</Button>;
}
```

## RLS pra admin tables

```sql
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_interactions ENABLE ROW LEVEL SECURITY;

-- Audit log: só admin lê
CREATE POLICY "Admins read audit" ON admin_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- CS interactions: aluno vê próprias, admin vê tudo
CREATE POLICY "Members view own org interactions" ON cs_interactions FOR SELECT USING (
  organization_id IN (SELECT current_user_orgs())
);
CREATE POLICY "Admins manage interactions" ON cs_interactions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
```

## Gating no front

```tsx
function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  
  if (!user || !profile?.is_admin) return <Navigate to="/" />;
  
  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

// Em App.tsx:
<Route path="/admin/*" element={<AdminLayout>...</AdminLayout>} />
```

## Checklist

- [ ] AdminLayout com gating por is_admin
- [ ] Lista users + impersonate
- [ ] Lista orgs + edição de seats/plan
- [ ] Lista journeys + filtros (travadas, novas, etc)
- [ ] Botão "Gerar Jornada" pra orgs antigas
- [ ] Edge function admin-impersonate (com audit log)
- [ ] Schemas: admin_audit_log, cs_assignments, cs_interactions
- [ ] Dashboard com métricas
- [ ] CRUD de content (projects + lessons + accelerators)

## Próximo

`11-NOTIFICACOES.md`
