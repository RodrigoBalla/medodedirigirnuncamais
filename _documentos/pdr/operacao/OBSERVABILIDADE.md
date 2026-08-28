# Observabilidade

> Logs, métricas, debug. Você precisa enxergar o que tá acontecendo em produção.

## Logs estruturados

### Frontend (browser)

Não use `console.log` solto em produção. Crie helper:

```typescript
// src/lib/logger.ts
const isDev = import.meta.env.DEV;

export const log = {
  info: (msg: string, meta?: any) => {
    if (isDev) console.log(`[INFO] ${msg}`, meta);
    // Em prod: manda pro Sentry ou Logflare
  },
  warn: (msg: string, meta?: any) => {
    console.warn(`[WARN] ${msg}`, meta);
  },
  error: (err: Error | string, meta?: any) => {
    console.error(`[ERROR]`, err, meta);
    if (typeof Sentry !== 'undefined') Sentry.captureException(err, { extra: meta });
  }
};
```

### Edge Functions

```typescript
console.log(JSON.stringify({ level: 'info', msg: 'Webhook received', user_id, event_type }));
```

Logs aparecem em **Supabase Dashboard > Edge Functions > Logs**.

### Postgres

Habilitar log de queries lentas:
```sql
ALTER DATABASE postgres SET log_min_duration_statement = 1000; -- ms
```

## Sentry (frontend errors)

```bash
npm install @sentry/react
```

```tsx
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
});

// Wrappa o App
const App = Sentry.withProfiler(MyApp);
```

## Logflare ou similar (logs centralizados)

Supabase tem integração nativa com Logflare. Útil pra:
- Filtrar logs por edge function
- Buscar por user_id
- Alertas customizados

## Métricas (queries SQL prontas)

### Saúde geral

```sql
-- Alunos ativos últimos 7d
SELECT COUNT(DISTINCT user_id) FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '7 days';

-- Taxa de execução do mês
SELECT 
  COUNT(*) FILTER (WHERE phase = 'production') AS concluidas,
  COUNT(*) AS total,
  ROUND(COUNT(*) FILTER (WHERE phase = 'production') * 100.0 / NULLIF(COUNT(*), 0), 1) AS taxa
FROM user_journeys
WHERE started_at > NOW() - INTERVAL '30 days';

-- NPS (se você fizer pesquisa em coluna nps_score em profiles)
SELECT 
  AVG(nps_score) AS avg_nps,
  COUNT(*) FILTER (WHERE nps_score >= 9) AS promoters,
  COUNT(*) FILTER (WHERE nps_score BETWEEN 7 AND 8) AS passives,
  COUNT(*) FILTER (WHERE nps_score <= 6) AS detractors
FROM profiles WHERE nps_score IS NOT NULL;
```

### Saúde por aluno

```sql
-- Alunos travados há 5+ dias
SELECT 
  p.full_name, p.email,
  m.title AS current_step,
  AGE(NOW(), m.started_at) AS days_stuck,
  o.name AS organization
FROM auth.users u
JOIN profiles p ON p.id = u.id
JOIN organization_members om ON om.user_id = u.id AND om.status = 'active'
JOIN organizations o ON o.id = om.organization_id
JOIN user_journeys uj ON uj.organization_id = om.organization_id AND uj.is_active = true
JOIN missions m ON m.journey_id = uj.id 
  AND m.started_at IS NOT NULL 
  AND m.completed_at IS NULL
WHERE m.started_at < NOW() - INTERVAL '5 days'
ORDER BY days_stuck DESC;
```

### Custos de IA

```sql
-- Quanto está gastando em Gemini por mês
SELECT 
  DATE_TRUNC('day', created_at) AS dia,
  COUNT(*) AS chamadas,
  SUM(input_tokens) AS tokens_in,
  SUM(output_tokens) AS tokens_out
FROM ai_usage_log -- crie essa tabela pra trackear
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;
```

## Dashboard de admin

Crie `/admin/metrics` com cards:
- Alunos ativos hoje / 7d / 30d
- Taxa de execução
- Travamentos pendentes
- Vitórias registradas no mês
- Custos de IA mês corrente

Use **Recharts** ou **Tremor** pra gráficos.

## Alertas

### Alertas que importam

1. **Edge function quebrada** (>10% erro) — Sentry alert ou Logflare alert
2. **Aluno travado 5+ dias** — Cron diário cria alerta em `cs_interactions`
3. **Custo de IA acima de threshold** — Cron diário compara com mês anterior
4. **Pagamento falhou** (Stripe) — Webhook `invoice.payment_failed` notifica
5. **Disco do Supabase >80%** — Email automático do Supabase

### Como receber alertas

- WhatsApp do Frank/CS via UAZAPI
- Email via Resend
- Telegram (gratuito, fácil pra dev)

## Debug em produção

### Frontend: replay de sessão

Sentry Session Replay grava interações do user (com mascaramento de inputs sensíveis):

```tsx
Sentry.init({
  // ...
  integrations: [
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    })
  ],
});
```

Útil pra reproduzir bug do aluno.

### Backend: query timing

Identificar query lenta:

```sql
-- Top 10 queries mais lentas
SELECT calls, total_exec_time, mean_exec_time, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

### Edge Function: debug local

```bash
# Roda função localmente com hot reload
supabase functions serve <nome> --env-file ./supabase/functions/<nome>/.env

# Testa
curl -X POST http://localhost:54321/functions/v1/<nome> -d '{"foo":"bar"}'
```

## Audit log

Sempre logar ações sensíveis em `admin_audit_log`:

```typescript
await admin.from('admin_audit_log').insert({
  admin_id: requesterId,
  action: 'impersonate', // ou 'delete_user', 'override_gate', etc
  target_user_id: targetId,
  metadata: { reason: 'support ticket #123' }
});
```

Útil em LGPD (auditoria) + debug ("quem fez essa mudança?").

## Health check endpoint

Edge function simples:

```typescript
// supabase/functions/health/index.ts
serve(async () => {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: Deno.env.get('VERSION') || 'unknown'
  }), { headers: { 'Content-Type': 'application/json' } });
});
```

URL: `https://xxx.supabase.co/functions/v1/health` — usa em uptime monitor.

## Checklist

- [ ] Sentry configurado (frontend)
- [ ] Logs estruturados em edge functions
- [ ] Dashboard de admin com métricas
- [ ] Alertas configurados (WhatsApp/email)
- [ ] Health check endpoint
- [ ] Cron diário detecta travamentos
- [ ] Audit log em ações sensíveis
