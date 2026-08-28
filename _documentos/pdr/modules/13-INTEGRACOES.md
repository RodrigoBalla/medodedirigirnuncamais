# Módulo 13 — Integrações

> Padrões de integração com serviços externos. Edge functions, webhooks, secrets.

## Padrão geral de Edge Function

```typescript
// supabase/functions/<nome>/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const body = await req.json();
    
    // Cliente admin (service role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    // Validação de input
    if (!body.required_field) {
      return new Response(JSON.stringify({ error: 'Missing field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Lógica
    // ...
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Erro:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

## Webhook handler (idempotência obrigatória)

Webhooks podem chegar **2-3x** (retry do remetente). Sempre tolere:

```typescript
// 1. Identificador único do evento
const eventId = req.headers.get('x-event-id') || body.id;

// 2. Verifica se já processou
const { data: existing } = await supabase.from('webhook_log')
  .select('id').eq('event_id', eventId).single();

if (existing) {
  return new Response(JSON.stringify({ ok: true, duplicate: true }));
}

// 3. Processa
// ...

// 4. Registra
await supabase.from('webhook_log').insert({ event_id: eventId, processed_at: new Date().toISOString() });
```

## RPC SECURITY DEFINER pattern

Pra acessar dados que RLS bloqueia (ex: lookup em `auth.users`):

```sql
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER  -- roda com privilégios do criador (postgres)
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_user_by_email(text) TO service_role;
```

## Integrações específicas

### Stripe (assinatura recorrente)

```typescript
// Webhook
serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Invalid signature: ${err.message}`, { status: 400 });
  }
  
  switch (event.type) {
    case 'checkout.session.completed':
      // Cria org + member + dispara onboarding
      break;
    case 'customer.subscription.updated':
      // Atualiza plan/seats
      break;
    case 'customer.subscription.deleted':
      // Marca org como inativa
      break;
  }
});
```

⚠️ **Sempre validar assinatura HMAC**. Sem isso, qualquer um chama o endpoint e cria orgs falsas.

⚠️ **`verify_jwt: false`** em webhooks externos (Stripe não tem JWT).

### Hotmart / Kiwify (compra avulsa)

Webhook do gateway → cria org + member + dispara onboarding-webhook.

```toml
# config.toml
[functions.hotmart-webhook]
verify_jwt = false
```

Validar via secret do header (cada gateway tem o seu).

### UAZAPI (WhatsApp)

```typescript
const response = await fetch('https://yourinstance.uazapi.com/send/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'token': UAZAPI_TOKEN },
  body: JSON.stringify({
    number: '5511999999999@s.whatsapp.net', // direto
    // OU
    number: '120363xxx@g.us', // grupo
    text: 'Mensagem aqui'
  })
});
```

Group IDs de grupos importantes em variáveis de ambiente:
```
GROUP_PAIN_MAIN=120363xxx@g.us
GROUP_PAIN_SUPORTE=120363yyy@g.us
GROUP_CS_INTERNAL=120363zzz@g.us
```

### Cloud API oficial Meta (WhatsApp produção)

```typescript
const response = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: '5511999999999',
    type: 'template',
    template: {
      name: 'welcome_template_v1',  // template aprovado pela Meta
      language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'João' }] }]
    }
  })
});
```

⚠️ Templates precisam ser aprovados pela Meta antes (3-5 dias úteis).

### Panda Video (upload + streaming)

#### Upload
```typescript
// 1. Cria pre-signed URL
const upload = await fetch('https://uploader-us01.pandavideo.com.br/files', {
  method: 'POST',
  headers: { 'Authorization': PANDA_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ folder_id, video_id })
});

// 2. Frontend faz upload direto (TUS protocol)
// 3. Recebe video_external_id
```

#### Download MP4 (pra mandar pro AssemblyAI)
```typescript
// Solicita download assíncrono
await fetch(`https://api-v2.pandavideo.com/download-async/${videoId}`, {
  method: 'POST',
  headers: { 'Authorization': PANDA_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ quality: '360p', format: 'video', language: 'pt-BR' })
});

// Polling até ficar pronto
let mp4Url = '';
for (let i = 0; i < 60; i++) {
  await sleep(5000);
  const status = await fetch(`https://api-v2.pandavideo.com/download-async/${videoId}/video/360p/pt-BR`, {
    headers: { 'Authorization': PANDA_TOKEN }
  });
  const data = await status.json();
  if (data.status === 'ready') { mp4Url = data.url; break; }
}
```

⚠️ Erro comum: chamar download em vídeo recém-uploadado retorna `"Download only Converted video"`. Espere 5-10min após upload.

### AssemblyAI (transcrição)

```typescript
// 1. Submete transcrição
const submit = await fetch('https://api.assemblyai.com/v2/transcript', {
  method: 'POST',
  headers: { 'authorization': ASSEMBLYAI_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audio_url: mp4Url, // URL pública (Panda fornece)
    speech_model: 'best',
    language_code: 'pt',
    speaker_labels: true,
    webhook_url: `${SUPABASE_URL}/functions/v1/assemblyai-webhook`
  })
});

const { id } = await submit.json();
// Salva no banco lessons.assemblyai_transcript_id = id

// 2. AssemblyAI processa async (5-10min) e chama webhook quando pronto
```

### Gemini (geração de conteúdo)

```typescript
// Texto (Pro pra qualidade, Flash pra velocidade)
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
    })
  }
);

// Imagem
const imageResponse = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    })
  }
);
```

### Zoom (encontros ao vivo)

Use **Server-to-Server OAuth** app (não JWT app, deprecado):

```typescript
// 1. Gera token
const tokenRes = await fetch('https://zoom.us/oauth/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: `grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`
});
const { access_token } = await tokenRes.json();

// 2. Cria meeting
const meeting = await fetch('https://api.zoom.us/v2/users/me/meetings', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: 'Mentoria',
    type: 2, // scheduled
    start_time: '2026-05-15T19:00:00Z',
    duration: 60,
    settings: { auto_recording: 'cloud', join_before_host: true }
  })
});
```

### Resend (email)

```typescript
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'PAIN <ola@seudominio.com>',
    to: 'aluno@email.com',
    subject: 'Bem-vindo!',
    html: '<h1>Oi</h1>'
  })
});
```

## Variáveis de ambiente (todas as secrets)

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=          # ✅ pode ir no front (.env VITE_)
SUPABASE_SERVICE_ROLE_KEY=  # ❌ APENAS Edge Functions secrets

# IA
GEMINI_API_KEY=

# WhatsApp
UAZAPI_URL=
UAZAPI_TOKEN=
GROUP_PAIN_MAIN=
GROUP_PAIN_SUPORTE=
# OU Meta:
META_PHONE_NUMBER_ID=
META_TOKEN=
META_BUSINESS_ID=
META_VERIFY_TOKEN=

# Vídeo
PANDA_API_KEY=
PANDA_FOLDER_ID=

# Transcrição
ASSEMBLYAI_API_KEY=

# Pagamento
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
HOTMART_WEBHOOK_SECRET=

# Reuniões
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_ACCOUNT_ID=
ZOOM_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
```

⚠️ **Tudo que NÃO começa com `VITE_` (ou `NEXT_PUBLIC_`) NÃO vai pro front.** Configure como **Supabase Edge Function Secrets** no Dashboard.

## Padrão de retry

Pra chamadas externas que podem falhar:

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await sleep(1000 * Math.pow(2, i)); // backoff exponencial
    }
  }
  throw lastError;
}
```

## EdgeRuntime.waitUntil() — task longa em background

Edge functions tem timeout de 150s. Pra tarefa longa (gerar imagem, PDF), retorne 200 cedo e rode resto em background:

```typescript
serve(async (req) => {
  // Trabalho rápido
  await processLesson();
  
  // Trabalho longo em background
  const bgWork = async () => {
    await generateThumbnail();
    await generatePDF();
    await sendNotifications();
  };
  
  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore
    EdgeRuntime.waitUntil(bgWork());
  } else {
    bgWork().catch(console.error);
  }
  
  return new Response(JSON.stringify({ success: true }));
});
```

## Checklist

- [ ] Padrão Edge Function aplicado
- [ ] Idempotência em webhooks
- [ ] RPC SECURITY DEFINER pra lookup em auth.users
- [ ] Validação HMAC em todos os webhooks externos
- [ ] verify_jwt configurado (true por padrão, false só em webhooks)
- [ ] Retry com backoff em chamadas externas
- [ ] EdgeRuntime.waitUntil em tarefas longas
- [ ] Secrets configurados no Supabase Dashboard (não no .env do front)
