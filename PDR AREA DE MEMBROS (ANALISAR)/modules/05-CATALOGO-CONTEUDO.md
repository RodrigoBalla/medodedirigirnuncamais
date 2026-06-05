# Módulo 05 — Catálogo de Conteúdo

> Trilhas, módulos, aulas, materiais IA.

## Estrutura

```
projects (trilhas/módulos)
  └── lessons (aulas)
        ├── lesson_ai_materials (steps, FAQs, mindmap, transcript)
        └── user_lesson_progress (% assistido por usuário)
```

## Schemas

### `projects`

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY, -- slug ('starter', 'builder', 'crm-ai-first-implementacao')
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  hero_image TEXT,
  thumbnail TEXT,
  difficulty TEXT, -- 'Iniciante' | 'Intermediário' | 'Avançado'
  estimated_time TEXT, -- '5h', '2 semanas'
  category TEXT,
  funnel_stage TEXT, -- 'atracao' | 'qualificacao' | 'vendas' | etc
  display_in TEXT, -- 'fundamentos' | 'na-pratica' | 'aceleradores'
  total_lessons INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  
  -- Conteúdo educacional
  what_you_will_learn JSONB,
  prerequisites JSONB,
  tools_used JSONB,
  target_audience TEXT,
  project_outcome TEXT,
  estimated_time TEXT,
  tags JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `lessons`

```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  module_name TEXT, -- agrupador opcional dentro do project
  module_order INT,
  order_index INT NOT NULL DEFAULT 1,
  duration TEXT NOT NULL, -- '12min', '1h20'
  
  -- Vídeo
  video_url TEXT, -- HLS Panda Video
  thumbnail TEXT,
  
  -- IA processing
  processing_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'transcribing', 'processing', 'completed', 'error'
  assemblyai_transcript_id TEXT,
  transcript TEXT, -- limpo, com timestamps
  
  -- Outros
  ai_materials_status TEXT DEFAULT 'pending',
  supplementary_materials JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_project_order ON lessons(project_id, module_order, order_index);
```

### `lesson_ai_materials`

```sql
CREATE TABLE lesson_ai_materials (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  summary_text TEXT,
  steps_json JSONB DEFAULT '[]'::jsonb, -- [{id, title, description, timestamp, tips, codeSnippet}]
  faqs_json JSONB DEFAULT '[]'::jsonb,
  checklist_json JSONB DEFAULT '[]'::jsonb,
  mindmap_json JSONB DEFAULT '{}'::jsonb,
  code_snippets_json JSONB DEFAULT '[]'::jsonb,
  useful_links_json JSONB DEFAULT '[]'::jsonb,
  common_issues_json JSONB DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `user_lesson_progress`

```sql
CREATE TABLE user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_timestamp INT NOT NULL DEFAULT 0, -- segundos
  watch_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
```

## Pipeline de processamento de aula

Quando admin sobe uma aula nova:

```
1. Admin upload no Panda Video → recebe video_external_id
2. INSERT em lessons (processing_status='pending')
3. Edge function process-lesson é chamada
4. Solicita download MP4 ao Panda (download-async)
5. Quando MP4 pronto, envia URL pra AssemblyAI com webhook callback
6. AssemblyAI transcreve → chama webhook assemblyai-webhook
7. Webhook:
   - Limpa transcrição (Gemini 2.5 Pro corrige termos: "super base" → "Supabase")
   - Gera steps + FAQs + mindmap + code_snippets via Gemini 2.5 Pro
   - Gera thumbnail via Gemini 3 Pro Image (em background)
   - Chama generate-lesson-pdf (em background)
   - Atualiza lessons + lesson_ai_materials
8. Lesson fica processing_status='completed'
```

⚠️ **Importante**: pra evitar timeout de 150s da edge function, use `EdgeRuntime.waitUntil()` pra rodar thumb + PDF em background. O webhook responde 200 em ~125s, e tarefas longas continuam após.

## Geração de Steps + FAQs (Gemini 2.5 Pro)

Prompt principal:

```typescript
const prompt = `
Você é especialista em criar conteúdo educacional. Analise a transcrição abaixo (com timestamps em [MM:SS]) e gere JSON COMPLETO.

TRANSCRIÇÃO:
${transcriptWithTimestamps}

DURAÇÃO: ${audioDuration} segundos

Gere JSON com:
{
  "title": "...",
  "description": "...",
  "duration": ${audioDuration},
  "steps": [{"id":"step-1","title":"...","description":"... (mín 2-3 frases)","timestamp": <segundos>, "tips":["..."]}],
  "faqs": [{"id":"faq-1","question":"...","answer":"...","category":"conceito|implementacao|troubleshooting"}],
  "checklist": [{"id":"check-1","title":"...","priority":"high|medium|low"}],
  "mindmap": {"title":"...","nodes":[{"id":"n1","label":"...","children":["..."]}]},
  "codeSnippets": [{"id":"code-1","title":"...","language":"...","code":"...","explanation":"..."}],
  "usefulLinks": [{"id":"link-1","title":"...","url":"...","type":"documentation|tool"}],
  "commonIssues": [{"id":"issue-1","problem":"...","solution":"...","severity":"common|rare|critical"}]
}

INSTRUÇÕES:
1. STEPS: 8-15 passos detalhados, com timestamp em SEGUNDOS (converta MM:SS).
2. MINDMAP: 4-5 níveis de profundidade.
3. FAQS: 10-15 cobrindo conceitos, implementação, troubleshooting.
4. CHECKLIST: 10-15 itens práticos.
5. CODE_SNIPPETS: SÓ se houver código na transcrição.

Responda APENAS o JSON.
`;
```

## Geração de Thumbnail (Gemini 3 Pro Image)

```typescript
const prompt = `
Create a thumbnail image for an online course video about: "${title}".

Style: Cute orange robot mascot as main character (friendly AI assistant). 
Robot interacting with floating icons related to: ${topics.join(', ')}.
Dark gradient background (red/maroon to black). Modern 3D illustration.
NO text. Professional online course thumbnail look. High quality, vibrant.
Subtle glow around the robot.
`;

await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  })
});

// Response tem inlineData.data com base64 da imagem
// Upload pro Supabase Storage
```

## Player de aula (`/trilhas/:slug/aula/:id`)

### Layout
- Video player (HLS via hls.js)
- Tabs: Steps | FAQ | Transcrição | Materiais | Tutor IA
- Tracking de progresso (throttle 10s)
- Marca completed quando >=95% OU faltam <=5min do final
- Botão manual "Marcar como concluída"

### Tracking (importante)

```typescript
videoElement.addEventListener('timeupdate', () => {
  if (Date.now() - lastUpdate < 10000) return;
  lastUpdate = Date.now();
  
  const currentTime = video.currentTime;
  const duration = video.duration;
  const remaining = duration - currentTime;
  const progress = currentTime / duration;
  
  const shouldComplete = duration > 0 && (remaining <= 300 || progress >= 0.95);
  
  updateProgress({ 
    lessonId, 
    last_watched_timestamp: Math.floor(currentTime), 
    completed: shouldComplete || alreadyCompleted 
  });
});
```

## Componentes

```
src/components/lesson/
├── LessonCard.tsx        # Card pra grid de aulas
├── LessonGrid.tsx
├── VideoPlayer.tsx       # HLS player
├── LessonSteps.tsx       # Renderiza steps_json com timestamps clicáveis
├── LessonFAQ.tsx
├── LessonTranscript.tsx
├── LessonMaterials.tsx
└── LessonTutorChat.tsx   # IA tutor (em 09-IA-TUTOR.md)
```

## RLS

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_ai_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;

-- Conteúdo público pra todo authenticated
CREATE POLICY "Authenticated can view projects" ON projects FOR SELECT USING (auth.role() = 'authenticated' AND is_published = true);
CREATE POLICY "Authenticated can view lessons" ON lessons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can view materials" ON lesson_ai_materials FOR SELECT USING (auth.role() = 'authenticated');

-- Progress: só do próprio user
CREATE POLICY "Users manage own progress" ON user_lesson_progress FOR ALL USING (user_id = auth.uid());

-- Admin: ALL
```

## Checklist

- [ ] Schemas projects, lessons, lesson_ai_materials, user_lesson_progress
- [ ] Edge functions: process-lesson, assemblyai-webhook, generate-lesson-pdf
- [ ] Pipeline IA: Panda → AssemblyAI → Gemini → Storage
- [ ] Player com HLS + tracking
- [ ] Componentes lesson/*
- [ ] RLS

## Próximo

`06-ACELERADORES.md`
