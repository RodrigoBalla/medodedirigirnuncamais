# 🗺️ Mapa de Memória — Escola de Condutores (MDNM)

> Documento vivo com o **histórico descritivo e detalhado** de tudo o que foi construído
> neste projeto. Serve como memória de longo prazo: contexto, arquitetura, decisões,
> regras críticas e linha do tempo. **Atualize este arquivo** sempre que uma mudança
> relevante for feita.
>
> Complementa (não substitui): [`CLAUDE.md`](CLAUDE.md) (instruções pro agente),
> [`ESCOPO.md`](ESCOPO.md) (escopo formal) e [`README.md`](README.md).
>
> **Última atualização:** 2026-08-17.

---

## ⚠️ Estado atual (2026-08-17 — virada grande)

- **A plataforma foi RENOMEADA** de "Medo de Dirigir Nunca Mais" para **"Escola de Condutores"**.
  A MARCA antiga foi removida de todo o app/site/e-mails (o TEMA "medo de dirigir" como dor/assunto
  permanece). Trechos abaixo que ainda citam o nome antigo são **históricos**.
- **A Carla saiu do projeto.** Toda menção a ela e ao contato dela foi removida do app; o suporte
  agora é da **equipe** (WhatsApp **5521993685289**). O Balla está trazendo **instrutores como
  coprodutores** (50/50). *(Trechos que citam "Carla/Jó" abaixo são históricos.)*
- **Site público (/vendas + raiz deslogada) está em MANUTENÇÃO** (`public/manutencao.html`). A
  `sales.html` fica acessível só em `/sales.html` (privada, pro Balla editar). **Área de membros
  dos alunos segue 100% no ar.**
- **Direito de marca:** todos os copyrights agora dizem "Todo o conteúdo e a marca pertencem a
  **Manda Balla Produções — CNPJ 24.858.692/0001-71**".
- **Primeiro acesso:** vídeo de boas-vindas removido (só mensagem). **Login:** imagens removidas
  (painel navy). Git usa e-mail **noreply** do GitHub (GH007 bloqueava o gmail).
- **Capas dos produtos:** substituídas por **capas genéricas** (SVG navy+amarelo, volante, nome do
  produto) em `public/modulos/*-9x16.svg`; `products.image_url` apontando pra elas; título do
  principal no banco = **"Escola de Condutores (Módulo Completo)"**. Imagens genéricas pra Eduzz
  (JPG 1080×1080, geradas via sharp) entregues ao Balla p/ upload manual no painel da Eduzz.
- **Pendências:** renomear produtos na Eduzz + template WhatsApp `matricula_confirmada` (Meta);
  sales.html ainda tem Carla (Balla mexe depois); docs CLAUDE.md/ESCOPO.md ainda com nome antigo.

---

## 1. Visão geral

**Escola de Condutores (MDNM)** é uma **plataforma web gamificada / área de membros (LMS)**
para pessoas — em especial mulheres — que têm medo de dirigir. O curso é da **Carla (persona
pública "Jô")**, instrutora. A plataforma entrega os cursos em vídeo com uma camada de
gamificação estilo Duolingo (XP, moedas, missões, roleta, ranking, níveis), comunidade e
suporte direto.

- **Modelo de negócio:** venda de infoproduto via **Eduzz** (checkout + postback), entrega
  automática numa **SPA** hospedada na **Netlify** com backend **Supabase**.
- **Persona pública:** Carla / Jô. WhatsApp da Carla: **5521974703113**.
- **Dono da plataforma / criador das automações / tráfego:** **Balla** (Manda Balla).
  WhatsApp de suporte do Balla: **5521993685289**.
- **Identidade visual:** tema dark fixo — navy `#0B1A38` + amarelo `#FFD60A` (identidade
  de trânsito: fita amarela+preta, textura asfalto, padrão de pista). Tipografia **Lexend**,
  ícones **Material Symbols Outlined**.

---

## 2. Stack & Infraestrutura

| Camada | Tecnologia |
|---|---|
| Front | Vite + React 18 + TypeScript + Tailwind + framer-motion + react-router-dom |
| Back | Supabase (Postgres 17, Auth, Edge Functions Deno, Realtime, RLS, pg_cron, pg_net) |
| Hospedagem | Netlify |
| Vendas | Eduzz (checkout via bridge.js + webhook Postback 2.0 / MyEduzz Notifications) |
| Vídeo | Panda Video (marca d'água DRM + restrição de domínio) — **em migração pro YouTube** |
| E-mail | Brevo (API transacional + webhook de tracking, 15 eventos) |
| WhatsApp | Meta WhatsApp Cloud API (BM verificada) |
| Ads / Tracking | Meta Pixel + CAPI (server-side via edge function `meta-capi`) |

### URLs e identificadores
- **Produção:** https://medodedirigirnuncamais.com.br (migrou de `.netlify.app`; registro A no
  bomdominio). Também responde em `medodedirigirnuncamais.netlify.app`.
- **Repositório:** https://github.com/RodrigoBalla/medodedirigirnuncamais (branch `main`).
- **Supabase project_id:** `qkvinhzwiptfobdvsdtr` (org "RodrigoBalla's Org").
- **Netlify site_id:** `0b7e64e1-7dc1-44c1-9db2-dd8cf1f1bd4a`.
- **Admin (Balla):** `ocriativomarketing@gmail.com` (flag em `user_roles.role='admin'`).
- **Dev local:** http://localhost:8080 (`npm run dev`).

### Deploy (automático)
- **GitHub Actions** (`.github/workflows/deploy.yml`): cada `git push origin main` builda e
  faz `netlify deploy --prod` em ~2min. Secrets no repo: `NETLIFY_AUTH_TOKEN`,
  `NETLIFY_SITE_ID`, `VITE_SUPABASE_URL/PUBLISHABLE_KEY/PROJECT_ID`.
- **Edge functions** do Supabase são deployadas à parte (MCP `deploy_edge_function` ou
  `npx supabase functions deploy <nome> --project-ref qkvinhzwiptfobdvsdtr --no-verify-jwt`).
- **Fallback manual:** `npm run build` + `npx netlify deploy --prod --dir=dist` (o CLI local
  fica logado como Rodrigo Balla / Manda Balla Produções).
- ⚠️ O token do Netlify (`NETLIFY_AUTH_TOKEN`) pode **expirar** — sintoma no Actions:
  `Error: Unauthorized: could not retrieve project`. Fix: gerar novo Personal Access Token no
  Netlify → atualizar o secret no GitHub (`gh secret set NETLIFY_AUTH_TOKEN`).

---

## 3. ⚠️ Regras críticas do projeto

1. **Toda mudança na área de membros é GLOBAL pra TODAS as alunas, automaticamente.**
   Single SPA, single bundle, single banco. Não existe "mudança só pra testar" ou "só pra um
   grupo" sem modelar feature-flag explícita no banco. Bug visual/lógico afeta todo mundo →
   **sempre type-check antes de subir**, preferir mudanças incrementais, rollback rápido
   (Netlify 1-click).

2. **Cursos LIBERADOS aparecem SEMPRE antes dos trancados** em qualquer tela que liste cursos
   (não só `LibraryScreen`). Aluna: liberados → trancados (drafts nunca aparecem). Admin:
   published → draft.

3. **Padrões de código:** sem `overflow-x-hidden` (usar `overflow-x-clip`); sem `<select>`/
   `confirm()` nativos (usar componentes do design system); sem cores hardcoded (usar tokens);
   toda RPC `SECURITY DEFINER` + `SET search_path=public`; RLS sempre ligado em tabelas com
   dados de usuário; regenerar tipos TS após migrations.

---

## 4. Arquitetura & modelo de dados

### Tabelas-chave
- `products` — cursos (id, title, description, image_url, status `published|draft`, **checkout_url**).
- `modules` — módulos dentro de um curso.
- `lessons` — aulas dentro de um módulo (video_url = embed do Panda).
- `access_groups` — grupos de acesso (+ `eduzz_product_ids` jsonb, `eduzz_product_names` jsonb).
- `access_group_products` — M:N grupo → curso.
- `access_group_users` — M:N grupo → user (+ `granted_at`, `expires_at` = expiração de 12 meses).
- `enrolled_emails` — compras Eduzz (email, product_id, notes = log da compra, `pending_group_ids`, `refunded_at`).
- `scheduled_group_grants` — liberação escalonada (drip) de upsells (+7 dias).
- `profiles` (id + user_id; **auth mapeia pra `user_id`**, não `id`), `user_progress`, `user_roles`.
- `missions`, `user_missions`, `daily_wheel_*` (gamificação), `direct_messages`, `announcements`,
  `first_access_tokens`, `email_sends`, `email_cadences`, `coin_transactions`, `support_requests`.

### Grupos de acesso (produção)
| Grupo | group_id | eduzz_product_ids |
|---|---|---|
| **Acesso Completo** (método principal) | `f643bffb-403f-433d-ba1b-164889f76e2c` | 3022323, 3085197 |
| **Acesso Balizas** | `90bc91fd-9db4-4a1f-b84c-b9a642700d44` | 3024578, 3087136 |
| **Acesso Ladeiras** | `8170185c-6322-41c3-9eb1-b54e070a26af` | 3024599, 3087138 |
| **Acesso Marchas** | `f57c3226-ab07-4e65-8c82-d65cdab13fc1` | 3024604, 3087139 |
| **Acesso Mapa do Condutor** | `d36d2140-4770-4b98-b003-b0765ef7ad8e` | 3024612, 3087141 |
| **Acesso completo a plataforma** *(novo, 2026-08-13)* | `87b174f5-f094-4fe4-895e-dbc62c422da8` | 3084222 |

### Catálogo (84 aulas em 5 cursos)
- **Escola de Condutores — Método Completo** (módulo "Conhecendo o Carro") — 21 aulas.
- **Dominando as Balizas** — 12 · **Ladeiras** — 16 · **Marchas** — 14 · **O Mapa do Condutor** — 21.

### Controle de acesso (RLS + frontend)
- **RLS genérico por grupo:** a policy de SELECT em `lessons`/`modules` libera se o user é admin
  OU é membro (via `access_group_users` → `access_group_products` → produto published) E o
  `profiles.access_status <> 'expired'`. **Não há id de grupo hardcoded** — qualquer grupo ligado
  ao produto libera.
- **Frontend:** `LibraryScreen` calcula cursos liberados via `access_group_users` →
  `access_group_products`. Cursos published sem acesso = "trancados" (vão pra `/curso-info/:id`).
- `profiles.access_status` = `active|expired`. **Expired bloqueia TODA navegação** e mostra
  `<AccessExpiredScreen>` (renovar / falar com suporte). Admin sempre passa.

---

## 5. Fluxo de vendas & liberação de acesso (Eduzz)

1. **Compra na Eduzz** → dispara **postback** pro `eduzz-webhook` (URL do Supabase, com `?secret=`).
   Existem 2 configs de webhook na Eduzz (developers.eduzz.com → Console): **"Supabase - Liberação
   + WhatsApp"** (a nossa) e **"Make - Compra Aprovada"**.
2. O webhook extrai os itens (`data.invoice.items[]`), e pra cada item chama a RPC
   **`find_groups_for_eduzz_product(id, nome)`** — casa por **product_id** (prioridade 1) OU por
   **nome** (exato → contains fuzzy normalizando separadores → "core" antes do `|`).
3. **Se não mapear pra nenhum grupo MDNM → REJEITA** (grava `enrolled_emails.notes = "Eduzz
   IGNORADO ... motivo=produto nao mapeia pra MDNM"`, **não cria conta, não libera, não conta**).
   Isso evita conta-fantasma de OUTROS produtos do Balla (ex.: "EJC - 10 Jogos").
4. Se mapear e o pagamento aprovar: **cria a conta** (Auth, sem senha), salva `phone`+`display_name`,
   chama **`grant_or_schedule_groups(user, grupos, p_months=12, p_delay_days=7)`**:
   - **"Acesso Completo" (principal) libera na hora**; **upsells comprados JUNTO ficam agendados
     pra +7 dias** (drip) via `scheduled_group_grants` (cron `release-group-grants` libera depois).
   - **Upsell sozinho / grupo novo comprado sozinho → libera na hora** (branch "else").
5. Manda **e-mail de primeiro acesso** (Brevo, com `first_access_tokens`), dispara **WhatsApp**
   (template `matricula_confirmada`) e o **Purchase da Meta CAPI** (event_id = fatura, idempotente).
6. **Reembolso/cancelamento:** o webhook remove os grupos + limpa agendamentos pendentes.

### ⚠️ Armadilha de checkout (importante)
Ao trocar o checkout por uma **variação nova** na Eduzz, o **product_id muda**. Se o novo id/nome
não estiver em `access_groups`, o webhook **rejeita a venda** (IGNORADO). **Sempre cadastrar o
product_id + nome da variação nova ANTES de publicar** o checkout novo. Recuperar venda perdida:
developers.eduzz.com → Console → Webhook → **Histórico de envios** → achar o evento da config
"Supabase" → **Reenviar** (reprocessa com dados reais). O webhook recebe o `contentId` do checkout
(o número que aparece na página do checkout), que pode ser diferente do "product_id" mostrado na
lista de produtos — **validar sempre pelo contentId real do link**.

---

## 6. Edge Functions

No repo (`supabase/functions/`): `eduzz-webhook`, `panda-jwt`, `ads-stats`, `meta-capi`,
`nps-catalog`, `whatsapp-suporte`, `admin-first-access`, `generate-uber-hint`. Outras rodam
deployadas (não versionadas no repo): `first-access`, `submit-support-request`, `brevo-webhook`,
`send-course-notification`, `notify-new-lesson`, `run-email-cadences`, `run-inactivity-emails`,
`run-expiration-emails`, `keep-alive`.

- **`eduzz-webhook`** (v28+, verify_jwt=false) — coração das vendas (seção 5). Rejeita não-MDNM,
  drip, cria conta, e-mail/WhatsApp/CAPI. Secret: `EDUZZ_WEBHOOK_SECRET`.
- **`panda-jwt`** (v15) — assina JWT (HS256) da marca d'água do player Panda com o email da aluna.
  **Nega vídeo pra aluna expirada/reembolsada** (`access_status='expired'`), server-side; admin
  passa; fail-open em erro.
- **`meta-capi`** — Purchase/InitiateCheckout server-side (dedup por event_id).
- **`ads-stats`** — placar do tráfego (Meta Ads) pra aba Tráfego do admin e /trafego; aceita
  role `admin` e `support`.
- **`brevo-webhook`** (v3) — 15 eventos normalizados; credita XP (+50 abertura, +150 clique).
- **`whatsapp-suporte`** — fluxo reativo de liberação de acesso via WhatsApp (coexistência).
- **`run-email-cadences` / `run-inactivity-emails` / `run-expiration-emails`** — automações Brevo
  (upsell FSM, "sentimos sua falta" 7+ dias, "CNH suspensa" 30 dias antes de expirar).

---

## 7. Áreas do produto (features construídas)

### Área de membros (`AppLayout` → abas)
- **Cursos / Biblioteca** (`/biblioteca`): grid 1/2/3 colunas, thumbs 9:16 (formato reels).
  Cursos trancados: P&B + badge "Trancado" → `/curso-info/:id` (venda interna com checkout embedado).
- **Comunidade** (`/comunidade`): feed com foto + **stories reais 24h** (compressão no navegador,
  bucket com RLS, limpeza automática), 2 colunas no desktop, +5 moedas/publicação (teto 5/dia),
  guia da 1ª publicação, visualizador estilo celular.
- **Perfil** (`/perfil`): avatar clicável, edição de nome em tempo real, nível/XP.
- **Trilha / Missões / Ranking:** abas "Em breve" (locked pras alunas, "Preview" cyan pro admin).
- **Curso/Aula** (`/curso/:id` = `CoursePlayerScreen` fora do AppLayout; `/aula/:id` = missões):
  player Panda com marca d'água, comentários, autoplay, quiz por aula, modo desafio, roleta.

### Gamificação
- **Níveis unificados** (XP + moedas, começa no 1, máx. 33) — fonte única `user_progress`.
- **XP por e-mail** (+50 abertura, +150 clique via brevo-webhook), toast "+200 XP" no 1º login.
- **Plano da Semana, Missões Diárias, Bônus Diário, Roleta diária** — persistidos no banco (era
  localStorage, dava moeda em dobro), RPCs idempotentes server-authoritative.
- **Cashback:** moedas → cupom de desconto Eduzz (ativação via WhatsApp pra Carla). **Teto
  transparente de R$10/mês** de resgate (RPC `convert_coins_to_coupon`, `cashback_config.monthly_cap_brl`).
- **Provas por aula** (nota, trava) + **Pesquisa de compra bloqueante** (após Aula 00) + aba admin
  "Aproveitamento". **Pesquisa NPS** gamificada (recompensa 1000 moedas, upsell c/ desconto),
  aba admin com IA (OpenAI gpt-4o-mini via `nps-catalog`), acessível também em `/pesquisa` (sem login).
- **Missão anti-abuso:** teto diário de moedas de missão (`mission_config.daily_coin_cap=150`).

### Admin (`/admin`)
- Abas: **Alunas** (lista + busca por nome/email/telefone + stats + Painel de Controle + métricas
  de e-mail + "Espelho do acesso"/Visualizar como aluna read-only), **Cursos, Grupos**,
  **Notificações** (avisar em massa, e-mail HTML personalizado, segmentação por regras, templates
  reutilizáveis + auto-save), **Comentários** (moderação + deep link "Ver aula"), **Analytics**,
  **Relatórios**, **Tráfego** (placar da campanha via ads-stats), **Pesquisa NPS**, **Aproveitamento**.
- Botões: **Marcar reembolso** (desconta do lucro + expira acesso + revoga sessões),
  **Marcar expirada / Reativar**, **Gerar senha do aluno** + copiar mensagem pronta,
  **Copiar link / Reenviar e-mail de primeiro acesso**.
- **Papel `support`** (RBAC): ver tudo em leitura + responder mensagens, sem editar (segurança
  100% server-side). Era da Jô (`joautoescola`) — **revogado em 2026-08-13** (hoje ninguém tem support ativo).

### UX / mobile
- Cursor de carrinho amarelo com rastro de pneus (só na área de membros; skip touch/reduced-motion).
- Animação cinematográfica "novo módulo desbloqueado" (1x quando compra upsell).
- Tour guiado de boas-vindas no 1º login; tutorial da 1ª missão.
- PWA (manifest, service worker, ícones, tela offline); aviso "Nova versão disponível" (compara
  hash do bundle) pra aba antiga; transição entre abas com identidade de trânsito.
- Mobile pesado: header compacto (cabe em 320px), bottom nav enxuto, admin com abas roláveis.

### Vendas & páginas públicas
- **Sales page** (`/vendas`, `public/sales.html`): contador de turmas automático de 100 em 100
  (virada infinita, sem "esgotado"), Meta Pixel + InitiateCheckout, aviso LGPD, checkout Eduzz.
- **Página de obrigado** (`/obrigado`, `public/obrigado.html`): countdown 5min, 3 passos, suporte.
- **Política de Privacidade (LGPD) + Termos de Uso** (páginas reais).
- **`/console-api`**: console de demonstração da API do WhatsApp (pra análise Tech Provider Meta).

### Anti-pirataria / segurança
- **Marca d'água DRM do Panda** (email da aluna sobre o vídeo) é a proteção real; overlay do
  player, não fica queimada nos segmentos.
- Heurística `outerWidth-innerWidth` do `useAntiPiracy` **desligada por default** (falso-positiva).
- Reembolso/expiração revoga acesso a conteúdo (RLS), nega token do Panda e revoga sessões.

---

## 8. Linha do tempo (marcos)

- **2026-03** — Início do app (UI da trilha de direção, base Vite/React/Supabase).
- **2026-05** — Migração pro domínio `.com.br`; raiz deslogada abre `/vendas`; checkout embedado
  na área de membros (várias correções de "só carrega no refresh"); combo R$27 + novos links Eduzz.
- **2026-06** — Admin: notificações segmentadas + templates + espelho do acesso ("Visualizar como
  aluna"); chat direto admin↔aluna (realtime, presença online); link de 1º acesso via caminho.
- **2026-07** — Comunidade (feed + stories 24h); gamificação persistida no banco; níveis
  unificados; provas + pesquisa de compra; **Pesquisa NPS** + IA; painel de **Tráfego** (/trafego +
  aba admin) com CAPI/Pixel; sistema de reembolso; **drip de 7 dias** dos upsells + RLS de conteúdo
  por grupo; panda-jwt nega expirada; WhatsApp reativo na /obrigado; LGPD + Termos.
- **2026-08** — Teto transparente de cashback; anti-abuso de missões; papel `support`; turmas
  automáticas de 100 em 100; **(13/08) sessão detalhada abaixo**.
- **2026-08-17 — VIRADA:** Carla saiu → removida do app + contatos (suporte vira equipe);
  **rebrand** "Medo de Dirigir Nunca Mais" → **"Escola de Condutores"** (app/site/e-mails/PWA/edge
  functions; tema "medo de dirigir" mantido); **site público em manutenção** (`manutencao.html`,
  sales.html vira privada em `/sales.html`); copyright → **Manda Balla Produções · CNPJ
  24.858.692/0001-71**; primeiro-acesso sem vídeo (só mensagem); login sem imagens; git via
  e-mail noreply (GH007). Ver o callout "Estado atual" no topo.

---

## 9. Sessão 2026-08-13 (detalhado)

Tudo o que foi feito nesta data, em ordem:

1. **Troca de checkout da sales page** pra a variação nova `7WXG5VDY0A` (produto 3085197)
   — commit `5aebc33`. O deploy automático falhou (`Unauthorized: could not retrieve project`)
   porque o **`NETLIFY_AUTH_TOKEN` tinha expirado**. Subi manualmente pelo CLI, depois o Balla
   gerou um token novo → atualizei o secret (`gh secret set`) → re-rodei o deploy → **success**.
   Confirmado o checkout **embedado inline** (iframe `elements2.eduzz.com/7WXG5VDY0A`).

2. **Revoguei o papel `support`** da `joautoescola@gmail.com` (voltou a ser **aluna normal**,
   mantendo os 5 cursos liberados). Convenção confirmada: aluno normal **não tem** linha em
   `user_roles` (só admin/support têm).

3. **Baixei as 84 aulas** dos 5 cursos do Panda → pasta **`CURSO ONLINE/`** (por curso → módulo →
   aula), pra migração pro YouTube. MP4 limpos (sem marca d'água), 720p. Método: HLS de entrega
   `b-vz-438412f4-a64.tv.pandavideo.com.br/<id>/playlist.m3u8` abre só com header `Referer` (sem
   Widevine), baixado via `yt-dlp` — a "DRM" é overlay do player. (2,2 GB, 0 falhas.)

4. **Investiguei uma venda que não contabilizou** (`gleide258@gmail.com`). **Causa raiz:** a
   variação nova `7WXG5VDY0A` = product_id **3085197** / nome **"Escola de Condutores
   (Modulo completo)"** não estava mapeada → webhook **IGNOROU**. **Fix:** cadastrei o id 3085197 +
   o nome no grupo Acesso Completo. **Recuperação:** reenviei o postback real pelo Console de
   developers da Eduzz → conta criada + Acesso Completo + e-mail de 1º acesso + WhatsApp + CAPI
   (fatura 101736671, R$27). Também mapeei a variação **"(acesso completo)"** e verifiquei a
   `anjospatricia48` (não foi reembolso; já tinha acesso — 2 compras distintas). Varredura de 7
   dias: as outras rejeições eram do "EJC - 10 Jogos" (outro produto, corretamente ignorado).

5. **Atualizei os 4 checkouts de upsell** na área de membros (`products.checkout_url`) e cadastrei
   os product_ids novos nos grupos: Mapa (`39VKJJ1BWR` = **3087141**), Marchas (`60E2BB53W3` =
   3087139), Ladeiras (`1W32VVPG92` = 3087138), Balizas (`40QRDDAK9B` = 3087136). O Balla tinha
   passado 3036984 pro Mapa por engano — o link vende 3087141; corrigido.

6. **Conferi os order bumps** do checkout: os 5 (Mapa/Marchas/Ladeiras/Balizas OFERTA UNICA +
   "acesso completo" R$127) **mapeiam por nome** → liberam mesmo com id novo. Reforcei o nome
   exato do bump de Balizas.

7. **Criei o grupo "Acesso completo a plataforma"** (`87b174f5-...`) que libera **TODOS os cursos,
   atuais e futuros, por 12 meses**:
   - Ligado a todos os produtos (`access_group_products`) + **trigger `trg_autolink_full_platform`**
     (migration `autolink_full_platform_group`) que liga produto NOVO automaticamente.
   - RLS genérico por grupo já destrava o conteúdo (sem mexer em RLS/front).
   - Entregue pela oferta **`https://chk.eduzz.com/6W4GVO430Z`** (produto **3084222**). O id 3084222
     + o nome foram **movidos** do grupo antigo pro novo (pra a compra cair no branch "libera na
     hora", fora do drip de 7 dias).

8. **Barra de oferta "Acesso completo (OFERTA ESPECIAL)"** no topo da área de membros:
   - Começou como botão → virou **barra FIXA (sticky)** visível em todas as abas com scroll.
   - **Texto rotativo com fade in/out** (3 msgs: "Oportunidade única" / "Tudo o que a plataforma
     já tem" / "Clique aqui e saiba mais").
   - Clique → **página interna `/acesso-completo`** (`src/pages/AcessoCompleto.tsx`) que explica a
     oferta (todos os conteúdos atuais e futuros por 12 meses) com o **checkout Eduzz EMBUTIDO
     inline** (`EduzzCheckoutEmbed contentId="6W4GVO430Z"`).
   - **Visibilidade:** só pra quem **NÃO** tem o grupo de acesso completo (hook
     `useHasFullPlatformAccess`). Quem já comprou não vê. Sidebar do desktop compensa o offset.
   - A barra também aparece **DENTRO do módulo/aula** (`CoursePlayerScreen`, sticky no topo do
     `<main>`), visível enquanto a aluna estuda.

**Arquivos novos/alterados nesta sessão:** `public/sales.html`, `src/components/FullAccessBanner.tsx`
(novo), `src/pages/AcessoCompleto.tsx` (novo), `src/hooks/useHasFullPlatformAccess.ts` (novo),
`src/components/AppLayout.tsx`, `src/components/lms/CoursePlayerScreen.tsx`, `src/App.tsx`.
**Migrations/DB:** grupo novo + trigger + remapeamento de eduzz_product_ids/names.

---

## 10. Estado atual & pendências

**Ativo hoje:**
- 5 cursos publicados; oferta "Acesso completo a plataforma" (12 meses, tudo) ativa via banner.
- Deploy automático funcionando (token do Netlify renovado em 13/08).
- Ninguém com papel `support` (infra existe pra reativar quando quiser).

**Pendências / próximos passos possíveis:**
- **Migração Panda → YouTube:** vídeos baixados em `CURSO ONLINE/`; falta subir no YouTube e
  **trocar os `lessons.video_url`** do Panda pelos links do YouTube (lembrar da regra global).
- Ajustes finos da barra de oferta (textos exatos, comportamento no mobile) conforme o Balla ver.
- Lançar "Dominando as Ladeiras" quando o conteúdo gravado estiver 100%.
- KPI agregado de e-mail no Dashboard admin.
- Upload de foto/comentários em posts da Comunidade (hoje parciais).

---

## 11. Referências rápidas

- **Regras pro agente:** [`CLAUDE.md`](CLAUDE.md). **Escopo formal:** [`ESCOPO.md`](ESCOPO.md).
- **Fluxogramas:** `DOCS/` e `docs/` (geral, operação, suporte).
- **Deploy:** `.github/workflows/deploy.yml`.
- **Checkout embedado:** `src/components/lms/EduzzCheckoutEmbed.tsx` (helper `extractEduzzContentId`).
- **Acesso completo (novo):** grupo `87b174f5-...`, checkout `6W4GVO430Z`/produto `3084222`,
  hook `src/hooks/useHasFullPlatformAccess.ts`, página `src/pages/AcessoCompleto.tsx`, banner
  `src/components/FullAccessBanner.tsx`, trigger `autolink_full_platform_group`.

---

*Mapa de memória mantido pelo agente (Claude) + Balla. Ao concluir qualquer mudança relevante,
acrescente uma entrada na Linha do tempo (seção 8) e/ou detalhe na seção da área afetada.*
