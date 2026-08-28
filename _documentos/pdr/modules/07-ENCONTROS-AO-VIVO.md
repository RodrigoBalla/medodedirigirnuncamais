# Módulo 07 — Encontros ao Vivo

> Calls de mentoria gravadas + transcrição IA + agendamento. 2 tipos: hotseat (1:N pública) e suporte (1:1 privada).

## Tipos

- **Hotseat**: mentoria em grupo, 1 mentor + vários alunos, pública pra membros
- **Suporte**: call individual entre aluno e Suporte Técnico (Luiz)

## Fluxo

```
1. Admin cria meeting via zoom-create-meeting Edge Function
   (ou cron generate-weekly-calls cria meetings da semana automaticamente)
2. Aluno agenda (escolhe slot disponível no modal)
3. zoom-register-participant adiciona aluno na meeting
4. Aluno entra na call
5. Zoom grava
6. zoom-webhook recebe evento "recording.completed"
7. fetch-zoom-transcript baixa MP4 + VTT
8. panda-upload-recording sobe MP4 pro Panda Video (mesmo player das aulas)
9. process-transcript via AssemblyAI gera transcript limpo
10. Vídeo aparece em /encontros-ao-vivo (com badge "🆕 Novo")
```

## Schemas

### `live_meetings`

```sql
CREATE TABLE live_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('hotseat', 'support')),
  product_id TEXT NOT NULL DEFAULT 'main',
  
  -- Agendamento
  scheduled_at TIMESTAMPTZ,
  date_recorded TIMESTAMPTZ,
  duration TEXT, -- '45min'
  
  -- Vídeo
  video_url TEXT, -- Panda HLS
  thumbnail_url TEXT,
  
  -- Zoom
  zoom_meeting_id TEXT,
  zoom_join_url TEXT,
  zoom_recording_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'recorded', 'processing', 'published')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `call_sessions` (sessão individual de aluno)

```sql
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES live_meetings(id),
  user_id UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ,
  attended BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `call_session_recording_files`

```sql
CREATE TABLE call_session_recording_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES call_sessions(id),
  zoom_recording_id TEXT UNIQUE,
  file_type TEXT NOT NULL, -- 'VIDEO', 'TRANSCRIPT', 'AUDIO'
  file_extension TEXT,
  transcript_vtt TEXT,
  status TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `call_session_ai_content`

```sql
CREATE TABLE call_session_ai_content (
  session_id UUID PRIMARY KEY REFERENCES call_sessions(id),
  summary TEXT,
  key_topics JSONB,
  action_items JSONB,
  processing_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Edge Functions

| Função | Disparada por | O que faz |
|---|---|---|
| `zoom-create-meeting` | Admin / cron | POST Zoom API → cria meeting |
| `zoom-register-participant` | Aluno agenda | Adiciona aluno como participante |
| `zoom-webhook` | Zoom envia | Recebe evento `recording.completed` |
| `fetch-zoom-transcript` | zoom-webhook | Baixa MP4 + VTT |
| `panda-upload-recording` | fetch-zoom-transcript | Sobe MP4 pro Panda Video |
| `process-transcript` | manual ou auto | Roda Gemini pra extrair tópicos + action items |
| `generate-weekly-calls` | cron 1x/semana | Cria meetings da semana baseado em schedule |
| `send-call-reminder` | cron 1h antes | Manda WhatsApp lembrete |

## Página `/encontros-ao-vivo`

- Tabs: Hotseat | Suporte
- Search
- Cards: thumbnail (ou ícone se ainda processando), badge tipo + duração + data
- Click → player com transcript

## Modal "Agendar call com Suporte"

Aluno clica no botão "Suporte com Luiz" em qualquer step:

```tsx
<CallRequestModal>
  <h2>Agendar com Luiz Felipe</h2>
  
  {/* Mostra slots disponíveis da semana */}
  <SlotPicker meetings={availableSlots} onSelect={handleAgendar} />
  
  {/* OU ele descreve problema */}
  <Textarea placeholder="Conta o que tá travando..." />
  <Button onClick={handleSubmit}>Solicitar call</Button>
</CallRequestModal>
```

Submit → `request-support-call` Edge Function:
- Cria `help_requests` no banco
- Notifica grupo SUPORTE-IAP no WhatsApp via UAZAPI
- Mensagem: "🆘 [Nome] precisa de call. Mission: [X]. Descrição: [...]"

## Botões pra contato com humano

Espalhados pela jornada:

```tsx
{step.helpContact === 'cs' && <CsContactButton type="cs" />}
{step.helpContact === 'tech' && <CsContactButton type="tech" />}
```

`CsContactButton`:
- type=`cs` → abre WhatsApp direto da Simone (`https://wa.me/55...`)
- type=`tech` → abre `CallRequestModal`

## RLS

```sql
ALTER TABLE live_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view published meetings" ON live_meetings
  FOR SELECT USING (auth.role() = 'authenticated' AND is_published = true);

CREATE POLICY "Admins manage all" ON live_meetings
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

## Checklist

- [ ] Schemas live_meetings, call_sessions, call_session_recording_files, call_session_ai_content
- [ ] Edge functions Zoom + Panda + AssemblyAI
- [ ] Cron generate-weekly-calls
- [ ] Página /encontros-ao-vivo com tabs e search
- [ ] CallRequestModal
- [ ] CsContactButton
- [ ] Badge "Visto" / "Assistido" pros vídeos já vistos

## Próximo

`08-COMUNIDADE.md`
