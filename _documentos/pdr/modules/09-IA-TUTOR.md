# Módulo 09 — IA Tutor

> Tutor inteligente disponível em cada aula, com contexto da aula assistida (transcript, steps, FAQ). Responde dúvidas pontuais e técnicas.

## Princípio

IA tutor é pra **dúvida pontual sobre o conteúdo da aula**. Não é coach de jornada (humano faz isso). Não é resolvedor de bug genérico (Claude Code faz isso).

Resposta sempre:
1. Curta e direta
2. Citando o ponto da aula (timestamp)
3. Em português claro
4. Sugerindo próximo passo prático

## UX

Posicionado na **lateral do player de aula** (mobile: drawer no rodapé):

```
┌─────────────┬───────────┐
│             │ 💬 Tutor  │
│   VIDEO     │ ────────  │
│             │ [chat]    │
│             │ [input]   │
└─────────────┴───────────┘
```

Pre-prompts úteis:
- "Resuma essa aula em 3 bullets"
- "O que é [conceito X mencionado]"
- "Como aplico isso no meu negócio"
- "Me dá um exemplo prático"

## Arquitetura

```
Aluno digita pergunta
   ↓
Front envia: { lesson_id, question, conversation_id }
   ↓
Edge function ai-tutor:
  - Carrega contexto da aula (lessons.transcript + lesson_ai_materials.steps_json + faqs_json)
  - Carrega histórico da conversa (chat_messages WHERE conversation_id = X)
  - Constrói system prompt com contexto
  - Chama Gemini 2.5 Flash (rápido + barato)
  - Salva resposta em chat_messages
   ↓
Front renderiza resposta (streaming opcional)
```

## Schemas

```sql
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conv ON chat_messages(conversation_id, created_at);
```

## Edge function `ai-tutor`

```typescript
serve(async (req) => {
  const { lesson_id, question, conversation_id } = await req.json();
  const userId = await getUserIdFromJWT(req);
  
  // 1. Carrega contexto da aula
  const { data: lesson } = await supabase
    .from('lessons')
    .select('title, description, transcript, lesson_ai_materials!inner(steps_json, faqs_json)')
    .eq('id', lesson_id)
    .single();
  
  // 2. Carrega histórico (últimas 6 mensagens)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: false })
    .limit(6);
  
  // 3. Monta prompt
  const systemPrompt = `
Você é tutor de uma aula chamada "${lesson.title}".

CONTEXTO DA AULA:
${lesson.description}

PASSO A PASSO DA AULA:
${JSON.stringify(lesson.lesson_ai_materials.steps_json)}

FAQS:
${JSON.stringify(lesson.lesson_ai_materials.faqs_json)}

REGRAS DE RESPOSTA:
- Seja CURTO (3-5 frases máximo)
- Use português claro, sem jargão técnico
- Cite o timestamp do step relevante quando aplicável (ex: "veja em 2:35 da aula")
- Se a pergunta NÃO é sobre essa aula, redirecione: "Essa não é uma dúvida da aula. Pergunta no canal de Dúvidas Técnicas da comunidade."
- Sugira próximo passo prático ao final
- NÃO invente — se não souber, diga "Não sei essa parte específica, manda no Dúvidas Técnicas pra alguém te ajudar"
`;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.reverse(),
    { role: 'user', content: question }
  ];
  
  // 4. Chama Gemini Flash (rápido + barato)
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    body: JSON.stringify({
      contents: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.5, maxOutputTokens: 600 }
    })
  });
  
  const answer = (await response.json()).candidates[0].content.parts[0].text;
  
  // 5. Salva
  await supabase.from('chat_messages').insert([
    { conversation_id, role: 'user', content: question },
    { conversation_id, role: 'assistant', content: answer }
  ]);
  
  return new Response(JSON.stringify({ answer }), { headers: { 'Content-Type': 'application/json' } });
});
```

## Custos

Gemini 2.5 Flash:
- Input: ~$0.075 / 1M tokens
- Output: ~$0.30 / 1M tokens
- Pergunta média (com contexto da aula ~3k tokens) + resposta de ~200 tokens
- ≈ **R$0,001 por pergunta**

10k perguntas/mês = **R$10/mês**. Praticamente grátis.

## Componente Frontend

```tsx
// src/components/lesson/LessonTutorChat.tsx
function LessonTutorChat({ lessonId }: { lessonId: string }) {
  const [conversationId] = useState(() => uuid());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  
  async function sendMessage() {
    const userMsg = { role: 'user', content: input };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setSending(true);
    
    const { data } = await supabase.functions.invoke('ai-tutor', {
      body: { lesson_id: lessonId, question: input, conversation_id: conversationId }
    });
    
    setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
    setSending(false);
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Pre-prompts */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 p-3">
          {['Resuma a aula', 'O que é X', 'Como aplico', 'Exemplo prático'].map(p => (
            <button key={p} onClick={() => setInput(p)} className="text-xs border rounded-full px-3 py-1">
              {p}
            </button>
          ))}
        </div>
      )}
      
      {/* Chat */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-primary text-white' : 'bg-muted'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && <div className="animate-pulse">Pensando...</div>}
      </div>
      
      {/* Input */}
      <div className="p-3 border-t">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
        <button onClick={sendMessage}>Enviar</button>
      </div>
    </div>
  );
}
```

## Edge function `chat-manager` — gerenciar conversas

Lista, deleta, renomeia conversas. Padrão CRUD.

## RLS

```sql
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations" ON chat_conversations FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own messages" ON chat_messages FOR ALL USING (
  conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid())
);
```

## Anti-padrões

❌ **Não permita "loop infinito"** — limite a 30 mensagens por conversa
❌ **Não use modelo Pro** — Flash é 90% tão bom e 10x mais barato pra esse caso
❌ **Não dê acesso a dados sensíveis** — tutor recebe só transcript + steps, não dados de outros alunos

## Checklist

- [ ] Schemas chat_conversations + chat_messages
- [ ] Edge function ai-tutor (Gemini Flash)
- [ ] Edge function chat-manager
- [ ] Componente LessonTutorChat
- [ ] Pre-prompts default
- [ ] RLS

## Próximo

`10-ADMIN.md`
