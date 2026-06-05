# Prompt Master pro Claude Code

> Cole isso no Claude Code junto com o PRD. Ele constrói tua área de membros guiado.

---

## PROMPT PRINCIPAL — começo do projeto

```
Vou construir uma área de membros pra um programa de aceleração [substitua: mentoria/comunidade paga/formação/etc] usando o PRD que está em ./area-membros-prd.

Stack obrigatória:
- React 19 + Vite 6 + TypeScript + Tailwind 4 + shadcn/ui
- Supabase (Postgres + Auth + Storage + Edge Functions Deno)
- Multi-tenant via RLS desde o dia 1
- Hospedagem: Netlify

Antes de começar, leia em ordem:
1. ./area-membros-prd/README.md
2. ./area-membros-prd/00-VISAO.md
3. ./area-membros-prd/01-ARQUITETURA.md
4. ./area-membros-prd/02-PERSONAS.md
5. ./area-membros-prd/03-JORNADA-USUARIO.md
6. ./area-membros-prd/aprendizados/DECISOES.md
7. ./area-membros-prd/aprendizados/BUGS-CLASSICOS.md (CRÍTICO — não cometa esses bugs)

Depois trabalhe em FASES (entregue uma de cada vez, espere meu OK pra próxima):

**FASE 1 — Foundation (1-2 dias)**
- Setup Vite + React + TS + Tailwind 4 + shadcn/ui
- Supabase client + AuthContext + ProtectedRoute
- Schema base: profiles, organizations, organization_members, organization_invites
- RLS aplicada (current_user_orgs() + is_admin() helpers)
- Login/Signup/Reset Password
- Edge function set-user-password (com fix do bug listUsers — ver BUGS-CLASSICOS Bug 1)
- Edge function send-organization-invite

**FASE 2 — Onboarding + Jornada (3-5 dias)**
- Schema: onboarding_sessions, user_journeys, missions, mission_tasks, journey_tracks, journey_stack_tools, journey_accelerators, execution_plans
- Onboarding 8 telas (modules/03-ONBOARDING.md)
- Edge function onboarding-webhook
- Auto-geração v3 (modules/04-JORNADA-EXECUCAO.md — função generateV3Missions)
- Página /minha-jornada com componentes journey/* (header, goals, weekly review, roadmap, current step, bento grid)
- Sync automático aulas ↔ tasks
- Auto-completar mission quando todas tasks concluídas

**FASE 3 — Catálogo de Conteúdo (2-3 dias)**
- Schema: projects, lessons, lesson_ai_materials, user_lesson_progress
- Página /trilhas, /trilhas/:slug, /trilhas/:slug/aula/:id
- Player de aula HLS + tracking (5min antes ou 95% = completed)
- Tabs: Steps | FAQ | Transcrição | Materiais
- Edge functions process-lesson + assemblyai-webhook + generate-lesson-pdf

**FASE 4 — Aceleradores + Comunidade (2-3 dias)**
- Schema: accelerators, community_questions, community_answers
- Página /aceleradores + /aceleradores/:slug
- Página /comunidade/* (canais)
- Search full-text portuguese
- Card "Módulo vinculado" + badge "Trilha"

**FASE 5 — Encontros + IA Tutor (2-3 dias)**
- Schema: live_meetings, call_sessions, chat_conversations, chat_messages
- Edge functions: zoom-create-meeting, zoom-webhook, fetch-zoom-transcript, panda-upload-recording, ai-tutor
- Página /encontros-ao-vivo
- Componente LessonTutorChat
- CallRequestModal + CsContactButton

**FASE 6 — Admin + Notificações (2 dias)**
- Páginas /admin/* (users, organizations, journeys, content, calls, metrics)
- Edge function admin-impersonate (com audit log)
- Schema admin_audit_log + cs_assignments + cs_interactions
- Edge function send-whatsapp-notification + request-cs-contact + request-support-call
- Hooks/templates de email (Resend)

**FASE 7 — Operação (1-2 dias)**
- Hooks pre-deploy (Husky)
- Skill Auditor de Segurança
- netlify.toml com headers de segurança
- Sentry
- README com runbooks

REGRAS DE TRABALHO:
1. SEMPRE leia o módulo correspondente antes de implementar (./area-membros-prd/modules/XX-MODULE.md)
2. SEMPRE consulte database/RLS-PADRAO.md antes de criar tabela
3. SEMPRE aplique padrões de aprendizados/DECISOES.md
4. SEMPRE evite bugs em aprendizados/BUGS-CLASSICOS.md
5. Tom de voz: design/COPY-GUIDE.md
6. Pra estilizar, design/PRINCIPIOS.md + design/COMPONENTES.md
7. Pre-commit: rode npm run audit:security antes de commitar
8. NUNCA coloque service_role no front
9. NUNCA pule RLS em tabela nova
10. SEMPRE criar migration arquivo (não SQL solto no Dashboard)

Inicie pela FASE 1. Me mostre o que vai fazer antes de fazer (plano + arquivos a criar/modificar).
```

---

## PROMPT — Construir um módulo específico

Quando quer adicionar feature isolada num app que já existe:

```
Quero adicionar [Módulo X] no meu projeto existente.

1. Leia ./area-membros-prd/modules/XX-MODULE.md completo
2. Leia ./area-membros-prd/database/RLS-PADRAO.md  
3. Leia ./area-membros-prd/aprendizados/BUGS-CLASSICOS.md (se relevante pro módulo)
4. Veja meu schema atual: list_tables
5. Identifique o que falta:
   - Schemas (tabelas + RLS + triggers)
   - Edge Functions
   - Componentes React
   - Hooks
   - Páginas
6. Faça plano de implementação em ordem (dependências primeiro)
7. Execute uma tarefa de cada vez, espere meu OK

Comece pelo plano.
```

---

## PROMPT — Adicionar acelerador novo

```
Quero adicionar um acelerador no catálogo. 

Dados:
- Title: [Nome]
- Type: [skill | prompt | guia | template]
- Category: [Conteúdo & Marketing | Vendas & CRM | etc]
- Setup time: [X min]
- Dificuldade: [Iniciante | Intermediário | Avançado]
- Descrição curta: [...]
- Descrição longa: [...]
- Features (lista): [...]
- Pré-requisitos: [...]
- Stack: [...]

Faça em sequência:
1. Gera thumbnail via Gemini Image (use o prompt template em modules/05-CATALOGO-CONTEUDO.md)
2. INSERT em accelerators
3. INSERT em community_questions (channel novidades, is_pinned=true) com texto do anúncio
4. Envia mensagem no grupo principal do WhatsApp via UAZAPI
5. Adiciona POST_LINKS no NovidadesTab pro botão "Ir para X"
6. Build + commit + push + deploy

Apresenta o texto da Novidade + WhatsApp pra eu aprovar antes de publicar.
```

---

## PROMPT — Debugar problema

```
Tenho problema [DESCRIÇÃO]. Investigue ANTES de mexer em código:

1. Leia logs (Supabase get_logs ou Sentry)
2. Reproduza local se possível
3. Veja se é bug conhecido em ./area-membros-prd/aprendizados/BUGS-CLASSICOS.md
4. Identifique se é:
   - Bug isolado (afeta 1 usuário/org)
   - Bug global (afeta todo mundo)
   - Bug de configuração (env, secrets)
5. Proponha fix com escopo mínimo
6. NÃO mexa em código global pra fix pontual sem me consultar
7. Mostre plano antes de aplicar

Volte com diagnóstico em formato:
- O que aconteceu
- Causa raiz
- Quem é afetado
- Fix proposto (com escopo)
- Riscos
```

---

## PROMPT — Code review antes de PR

```
Vou abrir PR. Faça code review desse branch ANTES.

Cheque:
1. Service role no front? (BUGS-CLASSICOS Bug 1, 14)
2. RLS habilitado em tabela nova?
3. Edge function nova com verify_jwt correto?
4. Variáveis VITE_ corretas (sem secret)?
5. Migrations em arquivo (não no Dashboard)?
6. Componentes seguem design system?
7. Linguagem/copy seguem COPY-GUIDE.md?
8. Testes (se aplicável)
9. Documentação atualizada (CLAUDE.md, README)

Lista problemas encontrados em ordem de severidade.
Se for OK, pode dar luz verde.
```

---

## ANTI-PROMPTS (evite isso)

❌ "Construa toda a plataforma de uma vez" — caos garantido
❌ "Não precisa ler o PRD" — pula bugs conhecidos
❌ "Pula a parte de RLS, vou fazer depois" — dor garantida
❌ "Use a stack que você preferir" — fica fora do padrão

## Fechamento

Quando terminar uma fase, valide com este checklist:
- [ ] Migrations rodaram sem erro
- [ ] RLS aplicada em todas tabelas novas
- [ ] Edge functions deployadas
- [ ] Audit de segurança passou (`npm run audit:security`)
- [ ] Build sem erros (`npm run build`)
- [ ] Smoke test no localhost
- [ ] Commit com mensagem descritiva
- [ ] Documenta no README

Boa construção!
