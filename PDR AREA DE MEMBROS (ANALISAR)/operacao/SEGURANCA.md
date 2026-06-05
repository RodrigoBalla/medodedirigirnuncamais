# Segurança

## 5 áreas críticas (em ordem de impacto)

### 1. Service Role Key exposta no front 🚨🚨🚨

**O que é:** `SUPABASE_SERVICE_ROLE_KEY` ignora todas as RLS. Quem tem ela faz qualquer coisa no banco.

**Como vaza:** dev coloca no código `.tsx`, vai pro bundle, qualquer um pega no DevTools.

**Como detectar:**
```bash
grep -rE "service_role|SUPABASE_SERVICE_ROLE_KEY" src/
```

**Como prevenir:**
- ✅ Service role SÓ em Edge Functions (configurada como secret)
- ✅ Pre-push hook bloqueando se aparecer
- ❌ NUNCA fazer `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` (mesmo com VITE_ prefix)

### 2. RLS faltando ou policy fraca 🚨🚨

**O que é:** Tabela sem RLS = qualquer logado vê tudo. Policy `USING (true)` = idem.

**Como detectar:**
```sql
-- Tabelas sem RLS habilitado
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- Tabelas com RLS mas zero policies (bloqueia tudo, geralmente bug)
SELECT t.tablename FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public' AND t.rowsecurity = true AND p.policyname IS NULL;

-- Policies perigosas (USING true em SELECT/INSERT/UPDATE/DELETE)
SELECT tablename, policyname, cmd, qual FROM pg_policies
WHERE schemaname = 'public' AND (qual = 'true' OR qual IS NULL) 
  AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL');
```

**Como prevenir:**
- ✅ RLS habilitado em TODAS as tabelas (default deny)
- ✅ Padrões em `database/RLS-PADRAO.md`
- ✅ Audit periódico (pelo menos antes de cada release grande)

### 3. API Keys de provedores pagos no front 🚨🚨🚨

OpenAI, Anthropic, Stripe live, AWS — chave que tá no front é usada por qualquer um → cobra do seu cartão.

**Como detectar:**
```bash
grep -rE "sk-[a-zA-Z0-9_-]{20,}|sk_live_|sk-ant-api03-|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}" src/ dist/
```

**Como prevenir:**
- ✅ Chamadas pra APIs pagas SEMPRE via Edge Function proxy
- ✅ Edge Function valida `verify_jwt: true`
- ✅ Pre-push hook bloqueia se detectar pattern de chave

### 4. Edge Function sem `verify_jwt` em ação privada 🚨

**O que é:** edge function que deleta usuário, retorna dados sensíveis, etc com `verify_jwt: false` — qualquer um chama.

**Quando `verify_jwt: false` é OK:**
- Webhooks externos (Stripe, AssemblyAI, Hotmart) — eles não têm JWT do Supabase
- Mas precisa validar assinatura HMAC dentro do código

**Como detectar:**
```bash
# config.toml — procura functions com verify_jwt = false que NÃO tem "webhook" no nome
grep -A 1 "\[functions\." supabase/config.toml | grep -B 1 "verify_jwt = false"
```

**Como prevenir:**
- ✅ Default `verify_jwt: true` em toda nova função
- ✅ Quando `false`, validar assinatura HMAC do remetente
- ✅ Nome com "webhook" pra ficar claro

### 5. Storage bucket público com dado sensível 🚨

**O que é:** bucket `public=true` no Supabase Storage com nome `documents`, `invoices`, `private` — qualquer URL = baixar arquivo.

**Como detectar:**
```sql
SELECT name, public FROM storage.buckets WHERE public = true;
```

Buckets OK públicos: `avatars`, `public`, `lesson-thumbnails`. 
Buckets perigosos públicos: `documents`, `invoices`, `contracts`, `private`, `users-data`.

**Como prevenir:**
- ✅ Bucket privado por padrão. Use signed URL (createSignedUrl) pra acesso.
- ✅ Acesso via RLS de storage.objects.

## Checklist completo OWASP-like

### Auth
- [ ] Senha mínima 8 caracteres
- [ ] Email confirmation obrigatória
- [ ] Rate limit em login (Supabase Dashboard > Auth)
- [ ] Recovery via email funcional
- [ ] Logout limpa cache do React Query
- [ ] Tokens não logados (não logge em console)

### Authorization
- [ ] RLS habilitado em todas tabelas
- [ ] Policies por padrão multi-tenant (`current_user_orgs()`)
- [ ] Admin-only routes gated por `is_admin()`
- [ ] Impersonate registrado em `admin_audit_log`
- [ ] `service_role` apenas em Edge Functions

### Secrets
- [ ] Zero secrets em `src/`
- [ ] `.env.local` no .gitignore
- [ ] Edge Function secrets configuradas no Dashboard (não no .env do front)
- [ ] Rotação de secrets quando alguém sai do time

### Input validation
- [ ] Forms validados com zod (front)
- [ ] Edge Functions validam input
- [ ] Tamanho máx de upload (Storage)
- [ ] Sanitização de HTML em conteúdo de comunidade

### XSS
- [ ] React escapa por padrão (NÃO use `dangerouslySetInnerHTML` em conteúdo de usuário)
- [ ] Markdown renderizado via biblioteca segura (react-markdown com `remarkGfm`)

### CSRF
- [ ] Cookies SameSite (default Supabase)
- [ ] Webhook signature validation

### CORS
- [ ] Edge Functions com origins permitidos (não `*` em produção sensível)
- [ ] Headers de segurança (HSTS, X-Frame-Options, X-Content-Type-Options)

### Dependencies
- [ ] `npm audit` sem CVEs critical/high
- [ ] Dependências atualizadas (mensal)

### Logs
- [ ] Não logar tokens, senhas, dados sensíveis
- [ ] Logs estruturados (JSON)
- [ ] Sentry pra erros

## Pre-deploy automático (skill Auditor de Segurança IA)

Skill que automatiza tudo isso. Roda em 3 modos:

1. **Interativo** (`/audit-security`) — escaneia, explica cada problema em humano + técnico, aplica fixes com aprovação
2. **Pre-deploy-check** (15s) — roda em hook git pre-push, retorna exit code
3. **Diff-check** — roda só checagens relevantes pros arquivos alterados

Instala em qualquer projeto React + Supabase via:

```bash
unzip pain-security-audit.zip -d .claude/skills/
```

## Headers HTTP recomendados (netlify.toml)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.pandavideo.com.br wss://*.supabase.co"
```

## Quando contratar pentest profissional

Skill automatizada cobre 80-90% dos bugs comuns. Mas contrate humano quando:

- Lida com **dado de cartão** (PCI compliance)
- Lida com **dado de saúde** (HIPAA / LGPD agravada)
- Tem **mais de 10k usuários ativos**
- Vende pra **empresa grande** (B2B exige certificação SOC 2)
- Mexe com **finanças** (pagamentos, balanços)

Custo: R$ 3-15k/ano com empresa especializada.
