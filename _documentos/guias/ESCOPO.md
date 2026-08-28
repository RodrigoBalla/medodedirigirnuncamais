# Medo de Dirigir Nunca Mais — Escopo do Projeto

## 1. Visão geral

**Medo de Dirigir Nunca Mais** é uma plataforma web gamificada que ajuda pessoas com receio de dirigir a desenvolver confiança ao volante por meio de uma trilha de aprendizado estruturada, progressiva e divertida — no estilo Duolingo, mas aplicada ao contexto da autoescola brasileira.

O usuário evolui por **fases bloqueadas sequencialmente**, cada uma com missão, quiz, simulação e prática, ganhando **XP**, **conquistas** e aumentando seu **nível de confiança** registrado no banco.

- **Domínio do problema:** ansiedade automotiva / habilitação para dirigir
- **Público-alvo:** alunos de autoescola e motoristas inseguros (PT-BR)
- **Modelo:** aplicação web autenticada, com trilha educativa + área administrativa para acompanhamento de alunos.

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 5 + React 18 + TypeScript |
| UI | shadcn-ui (Radix UI) + Tailwind CSS + Framer Motion |
| Roteamento | React Router v6 |
| Estado/dados | TanStack Query, React Hook Form, Zod |
| Backend | Supabase (Auth + Postgres + Edge Functions + Realtime) |
| IA | Edge Function chamando `ai.gateway.lovable.dev` (Gemini Flash) |
| Mídia | Vimeo Player, GIFs (Giphy), vídeos Pixabay de fundo |
| Sons | Áudios customizados (acerto, erro, conquista) |
| Testes | Vitest + Testing Library |
| Build/dev | npm (com `bun.lock` também presente) |
| Origem | Projeto Lovable.dev importado |

---

## 3. Arquitetura de telas

### Rotas (`src/App.tsx`)

| Rota | Tela | Acesso |
|---|---|---|
| `/login` | Auth (login/cadastro) | Público |
| `/boas-vindas` | Vídeo de boas-vindas (primeiro acesso) | Logado |
| `/bem-vindo` | Welcome-back (retornantes) | Logado |
| `/` | Dashboard principal (home) | Logado |
| `/treinos` | Trilha gamificada | Logado |
| `/ranking` | Ranking de XP | Logado |
| `/comunidade` | Tela social | Logado |
| `/perfil` | Perfil do usuário | Logado |
| `/aula/:id` | Tela de aula (lesson) | Logado |
| `/conclusao` | Tela de conclusão de fase | Logado |
| `/admin` | Painel administrativo | Admin |
| `*` | NotFound | — |

### Layout
- **`AppLayout`** com header (XP, nível, confiança, streak, toggle tema) e bottom nav mobile (5 abas) + sidebar desktop.
- **`LessonScreen`** (1.416 linhas) é renderizado **fullscreen**, fora do AppLayout, durante uma aula.

---

## 4. Modelo de dados (Supabase)

### Tabelas

| Tabela | Campos principais | Função |
|---|---|---|
| `profiles` | `user_id`, `display_name`, `avatar_url` | Perfil exibido |
| `user_progress` | `completed_phases int[]`, `total_xp` (default 120), `confidence` (default 3), `welcome_video_views` | Estado do aluno |
| `user_roles` | `user_id`, `role enum('admin','user')` | Controle de acesso |
| `page_views` | `page_path`, `entered_at`, `duration_seconds`, `click_count`, `referrer_path` | Analytics + presence realtime |

### Segurança
- **RLS habilitado em todas as tabelas.**
- Usuário só vê seus próprios dados; admins veem tudo via função `has_role(uid, 'admin')`.
- Trigger `handle_new_user()` cria automaticamente `profile` + `user_progress` no signup.
- Função `assign_admin_by_email()` promove o email `ocriativomarketing@gmail.com` a admin.
- `page_views` está exposto via `supabase_realtime` para presence.

### Edge Function: `generate-uber-hint`
- Recebe pergunta + opções + índice correto.
- Retorna **dica indireta** falada pelo "Valtinho", motorista de Uber fictício, com tom coloquial brasileiro e máximo 3 frases.
- Usa modelo `google/gemini-3-flash-preview` via gateway Lovable.
- Trata rate limit (429) e payment required (402).

---

## 5. Conteúdo educativo (`src/data/driving-data.ts`)

### Módulo 1 — "Primeiros Quilômetros"

**3 fases ativas**, cada uma com 4 etapas (Missão → Quiz → Simulação → Prática):

| # | Fase | Foco | XP |
|---|---|---|---|
| 1 | Conhecendo o carro | Eliminar ansiedade inicial; pedais; câmbio | 50 |
| 2 | O jogo dos pés | Coordenação de pés; segunda marcha | 75 |
| 3 | Fluidez e direção | Volante, curvas, terceira marcha | 100 |

Cada quiz traz pergunta, 4 opções, explicação, GIF ilustrativo e emoji.

### Fases futuras (locked)
- 🤖 Modo Automático
- 🚦 Trânsito Leve
- ⛰️ Modo Subida
- 📋 Prova do Detran

### Conquistas
6 badges (3 desbloqueadas iniciais): Primeiro Passo, Pés Espertos, Fase 1 Completa, Marcha Fina, Coordenado, Sem Tranco.

### Checklist de prática
Cada fase tem 5 tarefas práticas marcáveis (ex.: "Partir em primeira → segunda → terceira", "Curva leve à direita").

---

## 6. Mecânicas de jogo

- **Trilha sequencial**: fase N só desbloqueia após fase N-1.
- **XP**: ganhos em quiz (+10 por acerto na primeira tentativa) e ao completar fase.
- **Sistema de retry**: erros vão para uma fila e são repetidos até acerto, sem ganhar XP extra.
- **Sons**: feedback auditivo para acerto, erro, check, all-done, conquista.
- **Animações**: Framer Motion para "fase desbloqueada", check de conclusão, pulsos.
- **Confiança**: escala 1–5 atualizada quando o aluno completa fase.
- **Onboarding por vídeo**: Vimeo player em `/boas-vindas`; após primeira visualização, retornantes vão para `/bem-vindo`.
- **Missões diárias** e **dica do dia** no dashboard.

---

## 7. Área administrativa (`/admin`)

Acesso restrito a `user_roles.role = 'admin'`. Página com 5 abas:

1. **Dashboard** — visão geral
2. **Students** — lista de todos os alunos com progresso, XP, confiança, último acesso; permite **resetar progresso**
3. **Modules** — gestão de módulos
4. **Reports** — relatórios
5. **Analytics** — `AnalyticsTab` baseado em `page_views`

---

## 8. Tracking & presence

- **`useActivityTracker`**: registra navegação, duração e cliques em `page_views`.
- **`usePresenceTracker`**: usa Supabase Realtime para indicar usuários online.
- **`useAdmin`**: hook que checa role do usuário atual.

---

## 9. Estrutura de pastas

```
src/
├── pages/                      # Index, Auth, Admin, NotFound
├── components/
│   ├── DrivingApp.tsx          # Orquestrador principal (780 linhas)
│   ├── LessonScreen.tsx        # Aula completa (1.416 linhas)
│   ├── WelcomeScreen.tsx       # Vídeo de boas-vindas
│   ├── WelcomeBackScreen.tsx   # Tela retornantes
│   ├── ConquestScreen.tsx      # Celebração ao completar fase
│   ├── CompletionScreen.tsx    # Tela /conclusao
│   ├── RankingScreen.tsx
│   ├── CommunityScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── AppLayout.tsx           # Header + bottom-nav + sidebar
│   ├── GifIllustration.tsx
│   ├── NavLink.tsx
│   ├── admin/                  # AnalyticsTab e afins
│   └── ui/                     # shadcn components
├── contexts/                   # AuthContext, ThemeContext
├── data/driving-data.ts        # PHASES, ACHIEVEMENTS, CHECKLIST_TASKS, STEPS
├── hooks/                      # useAdmin, useActivityTracker, usePresence, use-toast, use-mobile
├── integrations/supabase/      # Client gerado
├── lib/                        # sounds, utils
└── styles/, test/

supabase/
├── functions/generate-uber-hint/   # Edge Function IA
├── migrations/                     # 5 migrações SQL
└── config.toml
```

---

## 10. Funcionalidades futuras (sinalizadas no código)

- Módulos 2+: Automático, Trânsito Leve, Subida, Simulado Detran
- Sistema completo de comunidade (chat/posts)
- Streak diário (`streakDays` já existe no layout, hardcoded em 1)
- Mais conquistas e missões

---

## 11. Tom & identidade

- **Idioma:** Português brasileiro coloquial
- **Voz:** acolhedora, encorajadora, sem julgamento — tema central é "superar o medo"
- **Mascote/personagem IA:** "Valtinho", motorista de Uber experiente que dá dicas no quiz
- **Visual:** dark mode disponível, ícones Material Symbols, cores temáticas (success/primary), animações suaves
- **Slogan implícito:** *"Você não está mais reagindo. Está controlando."* (mensagem de conquista da Fase 3)

---

## 12. Comandos

```sh
npm install            # instala dependências
npm run dev            # dev server (porta 8080)
npm run build          # build de produção
npm run build:dev      # build em modo dev
npm run lint           # ESLint
npm run preview        # preview do build
npm run test           # vitest run
npm run test:watch     # vitest watch
```
