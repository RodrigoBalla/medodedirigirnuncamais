# 01 — Arquitetura

## Stack escolhida (e por quê)

### Frontend

| Tech | Versão | Por quê escolher |
|---|---|---|
| **React** | 19+ | Padrão de mercado, ecossistema enorme, Claude Code constrói bem |
| **Vite** | 6+ | Build fast, HMR instantâneo, deploy fácil |
| **TypeScript** | 5+ | Pega 80% dos bugs em desenvolvimento, IA escreve melhor com tipos |
| **Tailwind CSS** | 4+ | Sem briga com CSS, design consistente, IA reproduz design system fácil |
| **shadcn/ui** | latest | Componentes copiáveis (não dependência), customização total |
| **Framer Motion** | 12+ | Animações premium, melhora percepção de qualidade |
| **TanStack Query** | 5+ | Cache de dados server-state, invalidação fina, pré-fetch |
| **React Router** | 7+ | Roteamento SPA, suporte a data loaders |
| **Lucide React** | latest | Ícones consistentes, tree-shake automático |

### Backend (BaaS)

**Supabase** — Postgres gerenciado + Auth + Storage + Edge Functions Deno.

**Por que Supabase e não Firebase / AWS / backend custom:**
- ✅ Postgres real (SQL nativo, migrations versionadas, joins, transactions, RLS)
- ✅ Multi-tenant via RLS sai 90% pronto (vs custom: dias de desenvolvimento)
- ✅ Edge Functions com Deno são simples e gratuitas até X invocations
- ✅ Storage com buckets públicos/privados + signed URLs
- ✅ Realtime nativo se precisar
- ❌ Vendor lock-in razoável (mas migrável pra Postgres puro se precisar)
- ❌ Pricing escalonado depois de free tier

### Infraestrutura

| Camada | Escolha | Justificativa |
|---|---|---|
| Hospedagem | **Netlify** ou **Vercel** | Deploy via git, free tier generoso, Edge functions próprios opcionais |
| CDN | Auto (Netlify/Vercel) | Imagens e assets servidos rápido globalmente |
| Domínio | GoDaddy / Cloudflare | DNS + SSL automático |
| CI/CD | Git push → deploy automático | Sem CI complexo |
| Monitoramento | Sentry + Logflare | Erros + logs estruturados |

### Integrações terceiras

| Serviço | Uso | Alternativas |
|---|---|---|
| **Panda Video** | Hospedagem de aulas (streaming HLS + thumbs) | YouTube unlisted, Vimeo, Bunny |
| **AssemblyAI** | Transcrição automática de aulas e calls | OpenAI Whisper, Deepgram |
| **Gemini 2.5** | Geração de conteúdo (resumos, steps, mindmaps), imagem (thumbs) | OpenAI GPT-4, Claude |
| **UAZAPI** | WhatsApp não-oficial (mais barato) | Cloud API oficial Meta, Twilio |
| **Meta WhatsApp Cloud API** | WhatsApp oficial (sem risco de banimento) | UAZAPI, Twilio |
| **Stripe** | Assinatura recorrente | Pagar.me, Asaas |
| **Hotmart/Kiwify** | Compra avulsa de programas | Eduzz, Monetizze |
| **Zoom** | Encontros ao vivo + gravação | Google Meet, Daily.co |
| **Resend** | Emails transacionais | SendGrid, Mailgun |

## Multi-tenant arquitetura

### Princípio

Cada **organização** tem múltiplos membros. Aluno individual = organização de 1 pessoa. Empresa-cliente = organização com vários membros (sponsor + executores).

### Hierarquia

```
auth.users (1 conta = 1 pessoa)
   │
   └── organization_members (N:M)
            │
            └── organizations (entidade pagante)
                     │
                     ├── user_journeys (1 jornada por org)
                     │       ├── missions (7 etapas)
                     │       ├── mission_tasks
                     │       ├── journey_stack_tools
                     │       ├── journey_accelerators
                     │       └── journey_tracks (trilhas vinculadas)
                     │
                     ├── onboarding_sessions (1 onboarding por org)
                     ├── cs_assignments (CS responsável)
                     └── cs_interactions (histórico de contato)
```

### Papéis (`organization_members.role`)

- `sponsor` — dono da empresa-cliente, pode tudo (convidar, ver tudo, sair)
- `executor` — quem executa o programa no dia a dia (vê tudo da org)
- `viewer` — só leitura (ex: chefe que paga mas não executa)

### Decisão importante: `organization_id` vs `user_id`

A maioria das tabelas usa **`organization_id`** como filtro principal (não `user_id`). Por quê:
- A jornada pertence à organização, não à pessoa
- Se o membro muda (sai da empresa, troca de pessoa responsável), a jornada continua
- Métricas e progresso são da empresa-cliente

Exceções (tabelas com `user_id` direto):
- `user_lesson_progress` (progresso de assistido é pessoal)
- `user_victories` (vitórias registradas pela pessoa)
- `notifications`

## Estrutura de pastas (frontend)

```
src/
├── pages/                    # Rotas (1 arquivo = 1 rota)
│   ├── Index.tsx            # /
│   ├── Login.tsx            # /login
│   ├── Onboarding.tsx       # /onboarding
│   ├── MinhaJornada.tsx     # /minha-jornada
│   ├── Trilhas.tsx          # /trilhas
│   ├── ProjectDetail.tsx    # /trilhas/:slug
│   ├── LessonPlayer.tsx     # /trilhas/:slug/aula/:id
│   ├── Aceleradores.tsx     # /aceleradores
│   ├── EncontrosAoVivo.tsx  # /encontros-ao-vivo
│   ├── Comunidade.tsx       # /comunidade/*
│   ├── Perfil.tsx           # /perfil
│   └── admin/               # /admin/* (gated)
│       ├── AdminUsers.tsx
│       ├── AdminOrganizations.tsx
│       ├── AdminJourneys.tsx
│       └── AdminContent.tsx
│
├── components/              # Reutilizáveis
│   ├── ui/                  # shadcn primitivos (button, input, dialog...)
│   ├── journey/             # JourneyHeader, JourneyRoadmap, etc
│   ├── lesson/              # LessonCard, LessonGrid, VideoPlayer
│   ├── community/           # PostCard, ChannelTabs
│   └── admin/               # ImpersonateButton, OrgPicker
│
├── hooks/                   # React hooks customizados
│   ├── useAuth.ts
│   ├── useUserOrg.ts
│   ├── useJourney.ts
│   ├── useLessonProgress.ts
│   └── ...
│
├── lib/                     # Lógica não-React
│   ├── supabase/
│   │   └── client.ts        # Cliente Supabase (anon key)
│   ├── api/                 # Funções de API (lê/escreve Supabase)
│   │   ├── journey.ts
│   │   ├── lessons.ts
│   │   ├── organizations.ts
│   │   └── ...
│   └── utils.ts
│
├── types/                   # TypeScript types
│   ├── journey.ts
│   ├── lesson.ts
│   └── ...
│
├── contexts/                # React contexts
│   └── AuthContext.tsx
│
└── App.tsx                  # Roteamento + providers globais
```

## Estrutura do backend (Supabase)

```
supabase/
├── functions/                       # Edge Functions Deno
│   ├── set-user-password/           # auth.admin.updateUserById com fix do bug listUsers
│   ├── send-organization-invite/    # cria invite + envia email magic link
│   ├── manage-organization-member/  # add/remove membro
│   ├── onboarding-webhook/          # processa onboarding completo, cria journey
│   ├── approve-onboarding/          # admin aprova org após onboarding
│   ├── process-lesson/              # recebe vídeo Panda, dispara AssemblyAI
│   ├── assemblyai-webhook/          # callback transcrição → Gemini gera steps + thumb + PDF
│   ├── generate-lesson-pdf/         # gera PDF e thumbnail via Gemini
│   ├── generate-project-metadata/   # IA gera descrição/features de um project
│   ├── ai-tutor/                    # tutor com contexto da aula
│   ├── chat-tutor/                  # chat persistente
│   ├── send-whatsapp-notification/  # envio direto via UAZAPI
│   ├── whatsapp-group/              # add/remove membro do grupo PAIN
│   ├── send-welcome-message/        # mensagem WhatsApp pós-cadastro
│   ├── request-cs-contact/          # botão "Falar com CS" → WhatsApp da Simone
│   ├── request-support-call/        # botão "Suporte com Luiz" → grupo SUPORTE
│   ├── zoom-create-meeting/         # cria meeting na hora
│   ├── zoom-webhook/                # recebe gravação Zoom
│   ├── fetch-zoom-transcript/       # baixa transcript do Zoom
│   ├── process-transcript/          # processa transcript de call
│   ├── generate-weekly-calls/       # cron — gera calls da semana
│   ├── notify-new-discussion/       # avisa sobre nova thread na comunidade
│   ├── send-call-reminder/          # cron — lembrete pré-call
│   ├── admin-create-user/           # admin cria usuário direto
│   ├── admin-impersonate/           # admin loga como aluno (debug)
│   └── _shared/                     # utils compartilhados
│       ├── cors.ts
│       └── supabase.ts
│
├── migrations/                      # SQL versionado
│   ├── 0001_init.sql
│   ├── 0002_organizations.sql
│   ├── 0003_journeys.sql
│   └── ...
│
└── config.toml                      # config Supabase + verify_jwt por função
```

## Fluxo de dados típico (exemplo: assistir aula)

```
1. Aluno entra em /trilhas/builder/aula/abc-123
2. React Router → LessonPlayer.tsx
3. useQuery hook chama lib/api/lessons.ts
4. API lê tabela `lessons` (Supabase Postgres) com RLS
5. RLS valida: aluno pertence a uma org ativa? Tem acesso a esta trilha?
6. Lesson retorna com video_url (Panda HLS), transcript, steps, FAQs
7. LessonPlayer renderiza vídeo + materiais
8. onPlay → updateProgress dispara mutation
9. lib/api/progress.ts faz UPSERT em user_lesson_progress
10. Throttle a cada 10s pra não floodar
11. Quando atinge >=95% ou faltam <=5min → marca completed=true
12. Trigger no banco invalida queries do journey (auto-sync com tasks)
13. Dashboard atualiza percentual da etapa atual
```

## Decisões técnicas justificadas

### Por que React e não Next.js?

- **Vite é mais rápido** em dev e build
- Não precisamos de SSR (área de membros é gated, não SEO)
- Roteamento client-side é suficiente
- Menor complexidade pra IA construir

### Por que Tailwind 4 e não styled-components?

- Sem context provider extra
- Bundle final menor
- Claude Code escreve Tailwind 5x mais rápido
- Design system consistente sem briga

### Por que Edge Functions Deno e não Node?

- Cold start próximo de zero
- TypeScript nativo
- Imports HTTPS direto (sem `node_modules`)
- Já vem com Supabase (sem deploy adicional)

### Por que multi-tenant via RLS e não via schema separado?

- 1 schema com filtro de RLS = simples, escalável até 10k+ orgs
- Schema separado por tenant = inferno operacional (migrations replicadas)
- Performance é OK até centenas de milhares de linhas

### Por que TanStack Query e não Zustand/Redux?

- Server state ≠ client state. Ferramentas diferentes.
- Cache automático, invalidação por chave, pré-fetch
- 90% dos dados são server state (vêm do Supabase)
- Pra client state local (modal aberto, form), `useState` resolve

### Por que UAZAPI no início e Cloud API depois?

- UAZAPI: barato (~R$50/mês), rápido de configurar (15min), perfeito pra MVP
- Cloud API oficial Meta: zero risco de banimento, exige aprovação de templates, ~3-5 dias pra configurar
- Plataforma deve abstrair: trocar provedor = trocar 1 edge function, não código todo

## Convenções

- **Casos minúsculos** com hífen pra slugs (`crm-ai-first`, não `crm_ai_first`)
- **snake_case** pra colunas no Postgres
- **camelCase** pra props no React
- **PascalCase** pra componentes
- **kebab-case** pra arquivos de página
- **Idempotência sempre**: webhooks podem chegar 2x, edge functions precisam tolerar

## Próximos passos

Lê:
1. `02-PERSONAS.md` — quem usa
2. `03-JORNADA-USUARIO.md` — fluxo end-to-end
3. `database/ENTIDADES-CORE.md` — schema das tabelas
4. `modules/01-AUTENTICACAO.md` — primeira coisa a construir
