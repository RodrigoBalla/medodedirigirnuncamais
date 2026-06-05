# RLS — Padrões Multi-tenant

> 5-6 padrões que cobrem 95% dos casos. Aplique consistentemente.

## Princípios

1. **RLS HABILITADO em TODA tabela**. Sem exceção.
2. **Default deny** — nada passa se não tem policy.
3. **Service role IGNORA RLS** — usar só em Edge Functions, nunca no front.
4. **Policies separadas por operação** (SELECT, INSERT, UPDATE, DELETE) ou usar `FOR ALL`.

## Função helper: `current_user_orgs()`

Reutilizada em quase TODA policy. STABLE + SECURITY DEFINER pra performance:

```sql
CREATE OR REPLACE FUNCTION public.current_user_orgs()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_orgs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_orgs() TO authenticated;
```

## Função helper: `is_admin()`

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;
```

## Padrões por tipo de tabela

### 1. Tabela "owned by org" (a maioria)

Tabela com `organization_id`, qualquer membro ativo da org pode ver.

```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view <tabela>" ON <tabela>
  FOR SELECT USING (organization_id IN (SELECT current_user_orgs()));

CREATE POLICY "Members manage <tabela>" ON <tabela>
  FOR ALL USING (organization_id IN (SELECT current_user_orgs()));

CREATE POLICY "Admins manage all <tabela>" ON <tabela>
  FOR ALL USING (is_admin());
```

Aplica em: `user_journeys`, `onboarding_sessions`, `cs_interactions`, `cs_assignments`

### 2. Tabela "owned by journey" (filhos de journey)

```sql
CREATE POLICY "Members view <tabela>" ON <tabela>
  FOR SELECT USING (
    journey_id IN (
      SELECT id FROM user_journeys 
      WHERE organization_id IN (SELECT current_user_orgs())
    )
  );

-- Mesmo padrão pra UPDATE/INSERT/DELETE
CREATE POLICY "Admins manage" ON <tabela> FOR ALL USING (is_admin());
```

Aplica em: `missions`, `journey_tracks`, `journey_stack_tools`, `journey_accelerators`, `execution_plans`, `user_state_log`

### 3. Tabela "owned by mission" (netos de journey)

```sql
CREATE POLICY "Members view <tabela>" ON <tabela>
  FOR SELECT USING (
    mission_id IN (
      SELECT m.id FROM missions m
      JOIN user_journeys uj ON uj.id = m.journey_id
      WHERE uj.organization_id IN (SELECT current_user_orgs())
    )
  );
```

Aplica em: `mission_tasks`, `help_requests`

### 4. Tabela "owned by user direto"

`user_id` direto, só o dono vê:

```sql
CREATE POLICY "Users manage own" ON <tabela> 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins manage all" ON <tabela> 
  FOR ALL USING (is_admin());
```

Aplica em: `user_lesson_progress`, `user_victories`, `achievements`, `chat_conversations`, `user_content_views`

### 5. Tabela de conteúdo público (qualquer authenticated)

```sql
CREATE POLICY "Authenticated view content" ON <tabela>
  FOR SELECT USING (auth.role() = 'authenticated' AND is_published = true);

CREATE POLICY "Admins manage" ON <tabela>
  FOR ALL USING (is_admin());
```

Aplica em: `projects`, `lessons`, `lesson_ai_materials`, `accelerators`, `live_meetings`

### 6. Tabela de interação (community)

Authenticated lê, dono escreve, admin tudo:

```sql
CREATE POLICY "Authenticated view" ON community_questions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users create posts" ON community_questions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users edit own" ON community_questions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own" ON community_questions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins manage" ON community_questions FOR ALL USING (is_admin());
```

### 7. Tabela admin-only

```sql
CREATE POLICY "Admins only" ON admin_audit_log
  FOR ALL USING (is_admin());
```

Aplica em: `admin_audit_log`, `webhook_log` (e qualquer tabela operacional)

## Storage RLS

Pra buckets do Supabase Storage:

```sql
-- Bucket "documents" — só dono vê
CREATE POLICY "Users see own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND (auth.uid()::text = (storage.foldername(name))[1])
  );

-- Bucket "public" — qualquer authenticated vê
CREATE POLICY "Authenticated read public bucket" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'public' 
    AND auth.role() = 'authenticated'
  );

-- Admin sobe arquivos
CREATE POLICY "Admins upload all" ON storage.objects
  FOR INSERT WITH CHECK (is_admin());
```

## Anti-patterns evitar

❌ **`USING (true)`** em SELECT pra dado privado — qualquer logado vê tudo
❌ **Policy só pra SELECT, esquece UPDATE** — aluno consegue alterar dado de outro
❌ **Subselect sem índice** — performance ruim em tabelas grandes
❌ **Função SECURITY DEFINER sem `SET search_path`** — vuln de privilege escalation

## Performance: índices necessários

```sql
-- A maioria das policies usa current_user_orgs() que filtra organization_members
CREATE INDEX idx_org_members_user_status ON organization_members(user_id, status);

-- Índice em organization_id de cada tabela com RLS multi-tenant
CREATE INDEX idx_<tabela>_org ON <tabela>(organization_id);

-- Pra tabelas filhas: índice em journey_id ou mission_id
CREATE INDEX idx_missions_journey ON missions(journey_id);
CREATE INDEX idx_tasks_mission ON mission_tasks(mission_id);
```

## Teste de RLS

Antes de subir pra produção, **sempre teste**:

```sql
-- Simular contexto de um usuário
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"<user_id>", "role":"authenticated"}';

-- Tentar SELECT — deve retornar só linhas que o user pode ver
SELECT * FROM user_journeys;

-- Tentar UPDATE em linha de outra org — deve falhar
UPDATE user_journeys SET description = 'hack' WHERE organization_id = '<outra-org>';
```

Ou use ferramenta automatizada — Supabase tem extensão de testing.

## Migration de RLS

Sempre que criar tabela nova:

```sql
-- 1. Criar tabela
CREATE TABLE nova_tabela (...);

-- 2. Habilitar RLS
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

-- 3. Criar policies
CREATE POLICY "..." ON nova_tabela ...;

-- 4. Verificar
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'nova_tabela';
-- relrowsecurity deve ser true
```

⚠️ **Sem RLS habilitada, a tabela fica `BLOQUEADA pra todo mundo` (incluindo policies que você criou)**. Sempre ative.

## Pegadinha: Cache do PostgREST

Quando você cria uma tabela nova, o **schema cache do PostgREST não atualiza automaticamente**. Vai retornar `404 PGRST205` por alguns minutos.

Force reload:
```sql
NOTIFY pgrst, 'reload schema';
```

## Checklist

- [ ] Helper `current_user_orgs()` criado
- [ ] Helper `is_admin()` criado
- [ ] RLS habilitado em TODAS as tabelas
- [ ] Policies aplicadas seguindo padrões 1-7 acima
- [ ] Índices criados (`organization_id`, `journey_id`, etc)
- [ ] Storage policies definidas pra cada bucket
- [ ] Reload schema após criar tabelas (`NOTIFY pgrst`)
