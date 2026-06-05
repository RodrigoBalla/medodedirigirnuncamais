# Prompt pro Lovable

> Versão adaptada pra Lovable (constrói no browser).

## PROMPT INICIAL

```
Construir uma área de membros pra programa de aceleração com:

STACK:
- React + Vite + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Edge Functions)
- Multi-tenant via RLS

PRINCÍPIOS:
- Aluno entra e sabe O QUE fazer agora
- Multi-tenant desde o dia 1
- RLS em TODA tabela
- Service role SÓ em Edge Functions
- Tom humano + termo técnico em destaque

CRIE:

1. AUTH: profiles, login, signup, reset password, magic link
2. ORGS: organizations, organization_members, organization_invites
3. ONBOARDING: 8 telas conversacionais coletando empresa, objetivo 30 dias, gargalo, horas/semana
4. JORNADA: 7 etapas (Onboarding → Starter → Builder → Call → Acelerador → Implementação → Meta) com tasks, gates, stack tools, deadlines
5. CONTEÚDO: projects, lessons, lesson_ai_materials, video player HLS, IA tutor por aula
6. ACELERADORES: catálogo de templates/skills com filtros e download
7. ENCONTROS: calls Zoom gravadas, transcript IA
8. COMUNIDADE: 5 canais (geral, dúvidas, projetos, wins, novidades)
9. IA TUTOR: chat com contexto da aula via Gemini Flash
10. ADMIN: painel pra fundador (impersonate, gerenciar orgs, conteúdo, métricas)
11. NOTIFICAÇÕES: WhatsApp via UAZAPI + email Resend + in-app badges
12. PROGRESS: tracking de aulas, sync com tasks, vitórias, achievements

TABELAS PRINCIPAIS (mais de 30):
- profiles, organizations, organization_members, organization_invites
- onboarding_sessions, user_journeys, missions, mission_tasks, journey_tracks, journey_stack_tools, journey_accelerators, execution_plans
- projects, lessons, lesson_ai_materials, user_lesson_progress, accelerators
- live_meetings, call_sessions, call_session_recording_files
- community_questions, community_answers, community_votes, community_reactions
- chat_conversations, chat_messages
- cs_assignments, cs_interactions, help_requests, admin_audit_log
- user_victories, achievements, activity_log, user_state_log, user_content_views

RLS HELPERS:
- public.current_user_orgs() retorna SETOF UUID das orgs do user logado
- public.is_admin() retorna boolean
Use esses helpers em todas as policies.

EDGE FUNCTIONS CRÍTICAS:
- set-user-password (use RPC get_auth_user_id_by_email — NÃO use auth.admin.listUsers!)
- send-organization-invite
- onboarding-webhook (cria journey + tracks)
- process-lesson + assemblyai-webhook + generate-lesson-pdf
- ai-tutor + chat-manager
- send-whatsapp-notification + request-cs-contact + request-support-call
- zoom-create-meeting + zoom-webhook + fetch-zoom-transcript
- admin-impersonate

DESIGN:
- Dark mode editorial premium
- Cores: ink #0c0c0e (fundo), parchment #f8f6f1 (texto), amber #c8952e (CTAs)
- Tipografia: Instrument Serif (display) + DM Sans (body)
- Animações: Framer Motion (fade + slide)

CRÍTICO — NÃO COMETA ESSES BUGS:
1. auth.admin.listUsers() é PAGINADO a 50. Use RPC SQL pra buscar user.
2. RLS em TODA tabela. Default deny.
3. service_role NUNCA no front.
4. Order_index sem desempate cai em alfabético — sempre defina.
5. Cache PostgREST após criar tabela: NOTIFY pgrst, 'reload schema'.
6. Edge function timeout 150s — use EdgeRuntime.waitUntil() pra background.
7. Webhooks idempotentes (chegam 2-3x).
8. verify_jwt: true por padrão.

COMECE pela base (auth + orgs + RLS helpers) e vá adicionando módulos. Mostre o que vai fazer antes de fazer.
```

---

## NOTAS PRA LOVABLE

- Lovable é mais visual; ajuda muito que você descreva **o layout das telas**
- Cole partes do PRD direto (ele lê os arquivos do contexto)
- Quando construir parte sensível (RLS, edge function), revise com cuidado — Lovable pode pular
- Use o Auditor de Segurança IA depois pra checar
- **Conecte Supabase no Lovable** antes de pedir pra criar schema (Settings > Connect Supabase)
