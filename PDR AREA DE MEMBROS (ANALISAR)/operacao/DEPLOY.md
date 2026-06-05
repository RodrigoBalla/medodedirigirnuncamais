# Deploy

## Stack de hospedagem

- **Frontend:** Netlify ou Vercel (deploy via git push)
- **Backend:** Supabase (gerenciado)
- **Domínio:** GoDaddy / Cloudflare → DNS apontando pro Netlify/Vercel

## Setup inicial

### 1. Supabase

1. Criar projeto em https://supabase.com (escolha região próxima ao público — pra Brasil, **sa-east-1 / São Paulo**)
2. Copiar `URL` e `anon key` do dashboard
3. Configurar Auth providers (Email + Google opcional)
4. Configurar Site URL e Redirect URLs:
   - Site URL: `https://seuapp.com`
   - Redirect URLs: `https://seuapp.com/**`, `http://localhost:5173/**`
5. Configurar templates de email (Authentication > Email Templates)
6. Configurar Edge Function secrets (Settings > Edge Functions > Secrets):
   - `GEMINI_API_KEY`
   - `UAZAPI_TOKEN`
   - `PANDA_API_KEY`
   - `ASSEMBLYAI_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `RESEND_API_KEY`
   - `ZOOM_CLIENT_ID/SECRET/ACCOUNT_ID`
   - etc

### 2. Frontend

```bash
# Cria projeto Vite
npm create vite@latest meu-app -- --template react-ts
cd meu-app
npm install

# .env
echo "VITE_SUPABASE_URL=https://xxx.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=eyJxxx" >> .env.local

# Build & test
npm run build
npm run dev
```

### 3. Netlify

```bash
# Instala CLI
npm install -g netlify-cli
netlify login
netlify init  # cria site novo + conecta com git

# Deploy preview
netlify deploy --dir=dist

# Deploy produção
netlify deploy --prod --dir=dist
```

### 4. Domínio custom

No painel Netlify → Domain settings → Add domain → segue instruções de DNS.

## Workflow de deploy

### Local → Produção

```bash
# 1. Local: muda código
git status
npm run dev  # testa localhost:5173

# 2. Build local
npm run build

# 3. Commit
git add .
git commit -m "feat: <mudança>"
git push origin main

# 4. Deploy
netlify deploy --prod --dir=dist
```

### Migrations (Supabase)

```bash
# Cria migration nova
supabase migration new add_<nome>

# Aplica local
supabase db push --local

# Aplica em produção
supabase db push --linked
```

⚠️ **Cuidado**: `db push` pra produção é **irreversível**. Sempre teste local primeiro.

## Pre-deploy hooks (segurança)

Use a skill **Auditor de Segurança IA** que instala 3 níveis de proteção:

### Nível 1 — Hook git pre-push

Bloqueia `git push` se tiver chave exposta, RLS faltando, etc:

```sh
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

claude --headless --skill security-audit --mode pre-deploy-check 2>&1
exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "❌ Push abortado: problemas críticos pendentes"
  exit 1
fi
```

### Nível 2 — npm script

```json
{
  "scripts": {
    "audit:security": "node scripts/audit-quick.mjs",
    "predeploy": "npm run audit:security",
    "deploy": "npm run build && netlify deploy --prod --dir=dist"
  }
}
```

`npm run deploy` automaticamente roda audit antes.

### Nível 3 — CI/CD (Netlify build)

```toml
# netlify.toml
[build]
  command = "npm run audit:security && npm run build"
  publish = "dist"
```

Aborta build no Netlify se audit reprovar.

Detalhes completos em `operacao/SEGURANCA.md`.

## Configuração de cache

```toml
# netlify.toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

## Rollback

### Frontend (Netlify)

Painel Netlify → Deploys → click no deploy anterior → "Publish deploy".

### Backend (Supabase)

Migrations são **forward-only**. Pra desfazer, crie migration de "fix-rollback":

```sql
-- Migration que desfaz: 0042_remove_xyz.sql
DROP TABLE xyz;
```

Aplica via `supabase db push`.

## Backups

Supabase Free tem backup diário automático (retido 7 dias).
Pago: 30 dias + Point-in-Time Recovery.

Adicional manual: dump pro Storage com cron:

```bash
# Via cron job no Supabase ou GitHub Actions
pg_dump $DB_URL > backup-$(date +%Y%m%d).sql
gzip backup-*.sql
# Upload pro Storage
```

## Monitoramento

### Erros — Sentry

```bash
npm install @sentry/react
```

```tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
});
```

### Uptime — Better Uptime / UptimeRobot

Configurar pings em:
- `https://seuapp.com/` (frontend)
- `https://xxx.supabase.co/rest/v1/` (Supabase REST)
- `https://xxx.supabase.co/functions/v1/health` (edge function de health)

## Checklist antes de cada deploy

- [ ] `git status` limpo
- [ ] Testou no localhost
- [ ] Audit de segurança passou (`npm run audit:security`)
- [ ] Migrations aplicadas (`supabase db push --linked`)
- [ ] Edge functions deployadas (`supabase functions deploy <nome>`)
- [ ] Build sem erros (`npm run build`)
- [ ] Variáveis de ambiente conferidas no Netlify
- [ ] Deploy de teste primeiro: `netlify deploy --dir=dist`
- [ ] Smoke test no preview URL
- [ ] Deploy produção: `netlify deploy --prod --dir=dist`
- [ ] Confirmar bundle novo no DOM (pega hash do `index-*.js` e checa)
