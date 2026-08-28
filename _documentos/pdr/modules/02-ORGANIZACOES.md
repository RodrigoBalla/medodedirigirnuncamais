# Módulo 02 — Organizações (Multi-tenant)

> **Coração da plataforma.** Define quem é cliente pagante, quem pode ver o quê, quantas pessoas podem entrar.

## Modelo

```
auth.users (1 conta = 1 pessoa)
    ↕ (N:M via organization_members)
organizations (entidade pagante / cliente)
    ├── organization_members (papéis: sponsor, executor, viewer)
    └── organization_invites (convites pendentes)
```

## Schemas

### `organizations`

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium', 'enterprise')),
  seats_limit INT NOT NULL DEFAULT 1,
  
  -- Contrato
  contract_start DATE,
  contract_end DATE,
  
  -- Billing
  billing_contact_name TEXT,
  billing_contact_email TEXT,
  billing_contact_phone TEXT,
  
  -- Branding (opcional)
  logo_url TEXT,
  
  -- Origem (utm/marketing)
  utm_source TEXT,
  utm_campaign TEXT,
  
  -- Comercial
  original_price NUMERIC,
  negotiated_price NUMERIC,
  discount_percent NUMERIC,
  installments INT,
  
  -- Operacional
  notes TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

### `organization_members`

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('sponsor', 'executor', 'viewer')),
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org_status ON organization_members(organization_id, status);
```

### `organization_invites`

```sql
CREATE TABLE organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'executor' CHECK (role IN ('sponsor', 'executor', 'viewer')),
  job_title TEXT,
  invited_by UUID REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_token ON organization_invites(token);
CREATE INDEX idx_invites_email_pending ON organization_invites(email) WHERE accepted_at IS NULL;
```

## Papéis e permissões

| Papel | Pode | Não pode |
|---|---|---|
| **`sponsor`** | Convidar/remover membros, ver tudo, mudar plano, cancelar contrato | (nada — é o dono) |
| **`executor`** | Ver tudo, executar jornada, completar tasks | Convidar/remover, mudar plano |
| **`viewer`** | Ler tudo (jornada, conteúdo, comunidade) | Marcar tasks, postar na comunidade |

## RLS pattern padrão

Padrão multi-tenant que se repete em quase TODA tabela:

```sql
-- Permite SELECT se o user é membro ativo da org dona da linha
CREATE POLICY "Members can view <table>" ON <table>
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );
```

⚠️ **Cuidado de performance:** subselect roda por linha. Use índice em `organization_members(user_id, status)`.

Otimização: criar **função `current_user_orgs()` STABLE** e usar nas policies:

```sql
CREATE FUNCTION public.current_user_orgs()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- Uso na policy:
CREATE POLICY "Members can view <table>" ON <table>
  FOR SELECT USING (organization_id IN (SELECT current_user_orgs()));
```

## Convite de membro — fluxo completo

### 1. Sponsor convida

UI: tela `/perfil/equipe` → botão "Convidar" → modal com email + role + job_title

```tsx
async function inviteMember(email: string, role: 'executor' | 'viewer', jobTitle: string) {
  // 1. Verifica se há seat disponível
  const { data: org } = await supabase.from('organizations').select('seats_limit').eq('id', orgId).single();
  const { count: members } = await supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active');
  const { count: pending } = await supabase.from('organization_invites').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).is('accepted_at', null).gt('expires_at', new Date().toISOString());
  
  if ((members || 0) + (pending || 0) >= org.seats_limit) {
    return { error: `Limite de ${org.seats_limit} membros atingido` };
  }
  
  // 2. Verifica se já é membro
  const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', email).single();
  if (existingUser) {
    const { data: existingMember } = await supabase.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', existingUser.id).single();
    if (existingMember) return { error: 'Já é membro' };
    
    // 3a. Já tem conta — adiciona como member direto (sem invite)
    await supabase.from('organization_members').insert({
      organization_id: orgId,
      user_id: existingUser.id,
      role,
      job_title: jobTitle,
      status: 'active',
      invited_by: currentUser.id,
      invited_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    });
    return { success: true };
  }
  
  // 3b. Não tem conta — cria invite
  const { data: invite } = await supabase.from('organization_invites').insert({
    organization_id: orgId,
    email,
    role,
    job_title: jobTitle,
    invited_by: currentUser.id,
  }).select().single();
  
  // 4. Dispara edge function pra enviar email
  await supabase.functions.invoke('send-organization-invite', { body: { invite_id: invite.id } });
  
  return { success: true };
}
```

### 2. Edge function envia email + WhatsApp

```typescript
// supabase/functions/send-organization-invite/index.ts
serve(async (req) => {
  const { invite_id } = await req.json();
  
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  
  const { data: invite } = await supabaseAdmin
    .from('organization_invites')
    .select('*, organizations!inner(name)')
    .eq('id', invite_id)
    .single();
  
  // Magic link via Supabase Auth
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    invite.email,
    {
      redirectTo: `${SITE_URL}/convite/${invite.token}`,
      data: { invite_id: invite.id, org_name: invite.organizations.name }
    }
  );
  
  return new Response(JSON.stringify({ success: true, invite_url: `${SITE_URL}/convite/${invite.token}` }));
});
```

### 3. Convidado clica no link → `/convite/:token`

```tsx
async function acceptInvite(token: string, password: string) {
  const { data: invite } = await supabase.from('organization_invites').select('*').eq('token', token).single();
  if (!invite || invite.accepted_at) return { error: 'Convite inválido ou expirado' };
  if (new Date(invite.expires_at) < new Date()) return { error: 'Convite expirado' };
  
  // Cria conta (ou login se já existe)
  const { data: { user } } = await supabase.auth.signUp({ email: invite.email, password });
  
  // Vincula como member
  await supabase.from('organization_members').insert({
    organization_id: invite.organization_id,
    user_id: user.id,
    role: invite.role,
    job_title: invite.job_title,
    status: 'active',
    invited_by: invite.invited_by,
    invited_at: invite.created_at,
    joined_at: new Date().toISOString(),
  });
  
  // Marca invite aceito
  await supabase.from('organization_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
  
  // Vai pro onboarding
  navigate('/onboarding');
}
```

## Hook `useUserOrg`

```tsx
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

export function useUserOrg() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-org', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations!inner(*)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();
      return data;
    },
    enabled: !!user,
  });
}
```

## Casos especiais

### Aluno individual (organização de 1 pessoa)

Quando o aluno paga sozinho (não empresa-cliente), criamos uma org com slug auto-gerado: `nome-do-user-XXXX`.

```sql
-- No webhook de pagamento (Stripe/Hotmart):
INSERT INTO organizations (name, slug, plan, seats_limit, billing_contact_email)
VALUES (user_full_name, slugify(user_full_name) || '-' || substr(md5(random()::text), 1, 4), 'basic', 1, user_email);

INSERT INTO organization_members (organization_id, user_id, role, status)
VALUES (org_id, user_id, 'sponsor', 'active');
```

### Mudança de plano (upgrade de seats)

Admin atualiza:

```sql
UPDATE organizations SET seats_limit = 10 WHERE id = ?;
```

Sem migration de dados — só limite.

### Sponsor sai (perde acesso)

Antes de deletar `organization_members`, garantir que outro sponsor existe (pelo menos 1 sponsor ativo por org). Se não, `error`.

## Admin actions

### Listar todas orgs

```tsx
const { data: orgs } = await supabase
  .from('organizations')
  .select('*, members:organization_members(count)')
  .order('created_at', { ascending: false });
```

### Detalhe de uma org

```tsx
const { data } = await supabase
  .from('organizations')
  .select(`
    *,
    members:organization_members(
      user:profiles(id, full_name, email, avatar_url),
      role,
      job_title,
      status,
      joined_at
    ),
    pending_invites:organization_invites(email, role, expires_at)
  `)
  .eq('id', orgId)
  .single();
```

### Impersonate (admin loga como aluno)

Edge function `admin-impersonate`:

```typescript
serve(async (req) => {
  const { user_id } = await req.json();
  
  // Valida que requester é admin
  const requesterId = await getUserIdFromJWT(req);
  const { data: requesterProfile } = await admin.from('profiles').select('is_admin').eq('id', requesterId).single();
  if (!requesterProfile?.is_admin) return new Response('Forbidden', { status: 403 });
  
  // Gera link de acesso temporário
  const { data: { properties } } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.email,
  });
  
  // Loga ação
  await admin.from('admin_audit_log').insert({
    admin_id: requesterId,
    action: 'impersonate',
    target_user_id: user_id,
  });
  
  return new Response(JSON.stringify({ login_url: properties.action_link }));
});
```

⚠️ **Sempre logar impersonations.** Trilha de auditoria obrigatória.

## RLS em `organizations`

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org" ON organizations
  FOR SELECT USING (id IN (SELECT current_user_orgs()));

CREATE POLICY "Sponsors can update own org" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'sponsor' AND status = 'active'
    )
  );

CREATE POLICY "Admins manage all orgs" ON organizations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

## Checklist

- [ ] Schemas `organizations`, `organization_members`, `organization_invites` criados
- [ ] Função `current_user_orgs()` SECURITY DEFINER
- [ ] RLS em todas as 3 tabelas
- [ ] Edge function `send-organization-invite` deployada
- [ ] Edge function `admin-impersonate` deployada (com audit log)
- [ ] Página `/convite/:token`
- [ ] Página `/perfil/equipe` (sponsor convida membros)
- [ ] Lógica de seats_limit antes de criar invite
- [ ] Hook `useUserOrg`

## Bugs conhecidos

⚠️ **Bug do `auth.admin.listUsers()` paginado** — descrito em `aprendizados/BUGS-CLASSICOS.md`. Use RPC `get_auth_user_id_by_email` em vez de listUsers().find().

## Próximo

`03-ONBOARDING.md` — onboarding conversacional gera plano personalizado.
