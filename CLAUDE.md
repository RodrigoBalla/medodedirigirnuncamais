# Medo de Dirigir Nunca Mais — Contexto do Projeto

## ⚠️ REGRA CRÍTICA — leia antes de qualquer mudança

**Toda mudança na área de membros é GLOBAL pra TODAS as alunas, automaticamente.**

Isso significa: qualquer alteração em código (UI, layout, lógica, banco) deve ser pensada como "isso vai aparecer pra TODA aluna assim que eu fizer deploy". Não existe "mudança só pra eu testar" ou "mudança só pra um grupo específico" — todo mundo vê o mesmo app.

Por que isso é assim por design:
- Single React SPA (Vite + React + TS) hospedado em **medodedirigirnuncamais.netlify.app**.
- Todas as alunas acessam o mesmo bundle JS — não há build segmentado por usuário/grupo.
- O banco (Supabase) é único; o que diferencia uma aluna da outra é **dados de acesso** (grupos, profile, progress), nunca **código**.
- Permissões (RLS + access_groups + access_group_users) controlam **o que cada aluna VÊ dentro do app**, mas o app em si é o mesmo.

### Implicações práticas
- Quando o Balla pede "muda X na biblioteca" → muda pra **todo mundo** depois do deploy.
- Quando o Balla pede "adiciona X na página de perfil" → idem.
- Se uma feature precisa ser opt-in/A-B/feature-flag → tem que ser **explicitamente** modelado no banco (ex: `feature_flags` ou `user_progress.experiments`). Sem isso, é roll-out total.
- Bugs visuais ou de lógica afetam **todas as alunas** simultaneamente — então: 1) sempre fazer type-check antes de subir, 2) preferir mudanças incrementais a refatores enormes, 3) capazes de rollback rápido (Netlify deploys têm 1-click rollback).

## ⚠️ REGRA IMUTÁVEL — Ordem dos cursos no catálogo (Balla 2026-05-11)

**Cursos LIBERADOS aparecem SEMPRE em primeiro lugar, antes dos trancados.**

Vale pra TODA tela onde a lista de cursos aparecer (não só `LibraryScreen`). Ao criar qualquer novo lugar que liste cursos:

1. Aluna logada → ordem: **liberados (acesso via grupo) → trancados (published sem acesso)**. Drafts nunca aparecem.
2. Admin logado → ordem: **published → draft**. Admin vê tudo, mas published vem primeiro.
3. Dentro de cada grupo, ordenação secundária é livre (created_at DESC é o default razoável).

Implementação atual em `src/components/lms/LibraryScreen.tsx`:
- Aluna: `[...products, ...lockedProducts]` na montagem do array do grid (linha ~115).
- Admin: filtro explícito por `status` antes de setar `setProducts` (linha ~62).

## Stack
- **Front:** Vite + React 18 + TypeScript + Tailwind + framer-motion + react-router-dom
- **Back:** Supabase (Postgres 17, Auth, Edge Functions Deno, Realtime, RLS)
- **Hospedagem:** Netlify
- **Vendas:** Eduzz (Postback 2.0 webhook → libera grupo de acesso automaticamente)
- **Vídeo:** Panda Video (DRM watermark + domain restriction)

## URLs principais
- **Prod:** https://medodedirigirnuncamais.netlify.app
- **Login:** /login (criar conta / entrar)
- **Área de membros (raiz):** / → renderiza `Index` → `DrivingApp` → `AppLayout`
- **Biblioteca:** /biblioteca (tab `biblioteca` no AppLayout)
- **Perfil:** /perfil
- **Comunidade:** /comunidade
- **Curso (aulas):** /curso/:id
- **Info de curso (página de venda interna):** /curso-info/:id
- **Admin:** /admin (só pra quem tem `user_roles.role = 'admin'`)
- **Sales page externa:** /vendas

## Identidade visual (design system)
- **Fundo:** navy `#0B1A38` (HSL 222 65% 13%) com gradiente radial sutil
- **Primary:** amarelo `#FFD60A` (HSL 50 100% 52%)
- **Acentos de trânsito:** fita amarela+preta (`.caution-tape`), padrão de pista (`.road-pattern`), textura asfalto (`.asphalt-texture`)
- **Tipografia:** Lexend (Google Fonts)
- **Ícones:** Material Symbols Outlined
- **Tema:** dark fixo (não tem toggle)

## Banco — tabelas-chave
- `products` (cursos: id, title, description, image_url, status `published|draft`, **checkout_url**)
- `modules` (módulos dentro de um curso)
- `lessons` (aulas dentro de um módulo)
- `access_groups` (grupos: ex "Acesso Completo")
- `access_group_products` (M:N grupo → curso)
- `access_group_users` (M:N grupo → user)
- `enrolled_emails` (compras Eduzz pendentes — vira grupo ativo quando user cria conta)
- `profiles`, `user_progress`, `user_roles` (admin/user)
- `missions`, `user_missions`, `daily_wheel_*` (gamificação)

## Padrões de código
- **Sem `overflow-x-hidden`** em containers grandes (cria scrollbar fantasma) — usar `overflow-x-clip`
- **Sem `<select>` ou `confirm()` nativo** — usar dropdown/modal custom no design system
- **Sem cores hardcoded** tipo `bg-emerald-500` — usar tokens (`primary`, `muted`, `accent`, `destructive`, `--success`)
- **Toda RPC** Supabase tem que ser `SECURITY DEFINER` com `SET search_path = public`
- **RLS** sempre habilitado em tabelas com dados de usuário
- **Tipos do Supabase** precisam ser regenerados depois de migrations (`generate_typescript_types` via MCP)

## Anti-piracy
- DRM Watermark no Panda Video é a proteção REAL
- Heurística `outerWidth - innerWidth` em `useAntiPiracy` é falso-positiva demais → **desligada por default** (threshold 360px se for ligada)
