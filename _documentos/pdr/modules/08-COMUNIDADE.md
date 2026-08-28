# Módulo 08 — Comunidade

> Canais de discussão entre alunos. Engaja, acelera aprendizado, gera networking, dá social proof.

## Canais

- **`novidades`** — Apenas admin posta. Pinned. Anúncios de novos aceleradores, atualizações.
- **`duvidas_tecnicas`** — Aluno tira dúvida sobre código/IA
- **`mostrar_projetos`** — Aluno compartilha o que construiu
- **`wins_conquistas`** — Vitórias (vendas, leads, deploys)
- **`geral`** — Bate-papo

## Schema

```sql
CREATE TYPE community_channel AS ENUM ('geral', 'duvidas_tecnicas', 'mostrar_projetos', 'wins_conquistas', 'novidades');

CREATE TABLE community_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel community_channel NOT NULL,
  
  -- Vínculos opcionais
  lesson_id TEXT,
  project_id TEXT REFERENCES projects(id),
  
  -- Engajamento
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  view_count INT NOT NULL DEFAULT 0,
  votes_count INT NOT NULL DEFAULT 0,
  answers_count INT NOT NULL DEFAULT 0,
  
  -- Mídia + tags
  image_urls TEXT[],
  tags TEXT[],
  
  -- Search
  search_vector TSVECTOR,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_channel_pinned ON community_questions(channel, is_pinned DESC, created_at DESC);
CREATE INDEX idx_questions_search ON community_questions USING gin(search_vector);

-- Trigger pra search_vector
CREATE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', coalesce(NEW.title,'') || ' ' || coalesce(NEW.body,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_search BEFORE INSERT OR UPDATE ON community_questions
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

```sql
CREATE TABLE community_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES community_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  votes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE community_votes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES community_questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES community_answers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, COALESCE(question_id, answer_id))
);

CREATE TABLE community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  question_id UUID REFERENCES community_questions(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- '👍', '❤️', '🔥', '🎉', '🚀'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id, emoji)
);
```

## Páginas

- `/comunidade/discussoes` — feed de duvidas_tecnicas + geral
- `/comunidade/projetos` — mostrar_projetos
- `/comunidade/wins` — wins_conquistas
- `/comunidade/novidades` — novidades (read-only pra alunos)
- `/comunidade/post/:id` — detalhe da thread

## Componentes

```
src/components/community/
├── ChannelTabs.tsx
├── PostCard.tsx
├── PostDetail.tsx
├── AnswerThread.tsx
├── ReactionPicker.tsx
├── NewPostDialog.tsx
└── NovidadeCard.tsx       # Card especial pra novidades (com botão CTA)
```

## Notificações

Quando alguém posta em `duvidas_tecnicas` ou responde uma thread, dispara:

- **In-app** (badge nas tabs)
- **WhatsApp** (opcional, via `notify-new-discussion` Edge Function)

## POST_LINKS — botão CTA em Novidades

Algumas novidades têm botão "Ir para X" que leva pra página específica:

```tsx
const POST_LINKS: Record<string, { label: string; url: string }> = {
  '<post-id>': { label: 'Ir para Novo Acelerador', url: '/aceleradores/<slug>' },
  '<post-id>': { label: 'Ir para Trilha X', url: '/trilhas/<slug>' },
};
```

No card da novidade, se `POST_LINKS[postId]` existir, renderiza botão grande clicável.

## RLS

```sql
ALTER TABLE community_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_answers ENABLE ROW LEVEL SECURITY;

-- Authenticated lê tudo
CREATE POLICY "Authenticated view all" ON community_questions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated view all answers" ON community_answers FOR SELECT USING (auth.role() = 'authenticated');

-- Aluno cria/edita o próprio
CREATE POLICY "Users create posts" ON community_questions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users edit own posts" ON community_questions FOR UPDATE USING (user_id = auth.uid());

-- Channel novidades: SÓ admin posta
CREATE POLICY "Only admins post novidades" ON community_questions FOR INSERT 
  WITH CHECK (
    channel != 'novidades' OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin manage all
CREATE POLICY "Admins manage all" ON community_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
```

## Checklist

- [ ] Schemas + search vector
- [ ] Páginas por canal
- [ ] Reactions emoji
- [ ] Search full-text em português
- [ ] POST_LINKS pra novidades
- [ ] Notificações in-app + WhatsApp
- [ ] RLS

## Próximo

`09-IA-TUTOR.md`
