# Módulo 11 — Notificações

> 3 canais: WhatsApp (CS), Email (transacional), In-app (badges).

## Estratégia por evento

| Evento | WhatsApp | Email | In-app |
|---|:-:|:-:|:-:|
| Convite aceito | ❌ | ✅ | — |
| Onboarding completo | ✅ (CS) | ❌ | — |
| Aula nova publicada | ✅ (grupo) | ❌ | ✅ |
| Acelerador novo | ✅ (grupo) | ❌ | ✅ |
| Travamento detectado | ✅ (CS) | ❌ | — |
| Nova thread comunidade | ❌ | ❌ | ✅ |
| Resposta na sua thread | ❌ | ✅ | ✅ |
| Reminder de call (1h antes) | ✅ | ✅ | ✅ |
| Reset de senha | ❌ | ✅ | — |
| Magic link | ❌ | ✅ | — |

## WhatsApp — UAZAPI vs Cloud API oficial

### UAZAPI (não-oficial)
- ✅ Barato (~R$50/mês)
- ✅ Setup em 15min
- ✅ API simples
- ❌ Risco de banimento (raro mas existe)
- ❌ Não tem templates aprovados

**Use pra:** MVP, validação inicial, comunicação interna

### Cloud API oficial Meta
- ✅ Zero risco de banimento
- ✅ Templates aprovados pela Meta
- ✅ Taxa de entrega superior
- ❌ Setup leva 3-5 dias (aprovação Meta)
- ❌ Templates fixos (mudou? tem que reaprovar)

**Use pra:** produção em escala, templates de marketing

## Implementação UAZAPI

### Edge function `send-whatsapp-notification`

```typescript
const UAZAPI_URL = 'https://yourinstance.uazapi.com';
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')!;

serve(async (req) => {
  const { number, text, group } = await req.json();
  
  // Resolve grupo OU número direto
  const target = group 
    ? GROUP_JIDS[group] // ex: 'cs' → '120363xxx@g.us'
    : `${number.replace(/\D/g, '')}@s.whatsapp.net`;
  
  const response = await fetch(`${UAZAPI_URL}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': UAZAPI_TOKEN },
    body: JSON.stringify({ number: target, text })
  });
  
  return new Response(JSON.stringify(await response.json()));
});
```

### Edge functions especializadas

- `request-cs-contact` — botão "Falar com CS" → WhatsApp da pessoa CS
- `request-support-call` — botão "Suporte com Luiz" → grupo SUPORTE
- `whatsapp-group` — adiciona/remove membro do grupo principal
- `send-welcome-message` — pós cadastro

### Botão "Falar com CS"

```tsx
function CsContactButton({ contact }: { contact: TeamMember }) {
  const sendMessage = async () => {
    await supabase.functions.invoke('request-cs-contact', {
      body: { reason: `Aluno ${user.full_name} clicou em Falar com CS` }
    });
    
    // Abre WhatsApp direto também
    window.open(`https://wa.me/${contact.whatsapp}?text=Oi%20${contact.name}`);
  };
  
  return <Button onClick={sendMessage}>Falar com {contact.name}</Button>;
}
```

## Email — Resend ou Supabase SMTP

Default: Supabase SMTP (gratuito, baixa volumetria, pode ir pra spam).
Recomendado pra produção: **Resend** (designed pra dev, deliverability boa, $20/mês até 50k emails).

### Templates principais

```
- magic-link.html (Supabase Auth gerencia)
- reset-password.html (Supabase Auth gerencia)
- welcome.html (custom, dispara após signup)
- new-answer.html (alguém respondeu sua thread)
- call-reminder.html (1h antes)
```

### Layout HTML simples

```html
<table style="max-width: 560px; margin: 0 auto; font-family: sans-serif;">
  <tr><td style="padding: 32px;">
    <h1>Oi {{ name }}</h1>
    <p>{{ body }}</p>
    <a href="{{ cta_url }}" style="background: #c8952e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">{{ cta_text }}</a>
  </td></tr>
</table>
```

## In-app — badges + tabs

```tsx
// useUnreadCounts hook
function useUnreadCounts() {
  return useQuery({
    queryKey: ['unread-counts'],
    queryFn: async () => {
      const { data: views } = await supabase.from('user_content_views').select('content_id, content_type').eq('user_id', userId);
      const seenIds = new Set(views?.map(v => `${v.content_type}:${v.content_id}`));
      
      // Conta items dos últimos 14 dias não vistos
      // ...
      
      return { '/comunidade/discussoes': 3, '/encontros-ao-vivo': 1, /*...*/ };
    }
  });
}

// Sidebar:
{tabs.map(tab => (
  <NavLink to={tab.href}>
    {tab.label}
    {unreadCounts[tab.href] > 0 && <Badge>{unreadCounts[tab.href]}</Badge>}
  </NavLink>
))}
```

## Schema `user_content_views`

```sql
CREATE TABLE user_content_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'lesson' | 'meeting' | 'post' | 'accelerator'
  content_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type, content_id)
);
```

## Padrão `isContentNew()`

```typescript
function isContentNew(createdAt: string, isViewed: boolean, daysThreshold = 14): boolean {
  if (isViewed) return false;
  const created = new Date(createdAt).getTime();
  const threshold = Date.now() - (daysThreshold * 86400000);
  return created > threshold;
}
```

Aplica em cards de aulas, posts da comunidade, novidades, encontros.

## Cron jobs

### `send-call-reminder` (1x por hora)

Roda hora em hora. Busca calls que começam em 1h, manda WhatsApp + email pros participantes.

### `process-pending-queue` (5min)

Processa fila de aulas/transcrições pendentes.

### `generate-weekly-calls` (1x semana, segunda 6h)

Cria meetings da semana baseado em schedule fixo (ex: hotseat toda quarta 19h).

### `detect-stuck-users` (1x dia)

Identifica alunos travados há 5+ dias e cria registro em `cs_interactions` com tipo `alert` pra CS atuar.

Configura via Supabase Cron Jobs (pg_cron).

## Checklist

- [ ] Edge function send-whatsapp-notification
- [ ] Edge function request-cs-contact + request-support-call
- [ ] Templates de email (welcome, new-answer, call-reminder)
- [ ] Schema user_content_views
- [ ] Hook useUnreadCounts + badges no UI
- [ ] Cron jobs (call reminder, stuck detection)
- [ ] Integração UAZAPI (com fallback pra Cloud API se quiser)

## Próximo

`12-PROGRESS-TRACKING.md`
