# Decisões Arquiteturais — Tradeoffs

> Por que cada escolha foi feita. Pra você não cair nas mesmas armadilhas.

## 1. Multi-tenant no schema desde o dia 1

**Decisão:** Toda tabela com dado de aluno tem `organization_id`. Nunca `user_id` direto pra dado compartilhado.

**Tradeoff:**
- ✅ Escala fácil pra empresa-cliente (vários membros)
- ✅ RLS multi-tenant é repetível
- ❌ Aluno individual = "org de 1 pessoa" (overhead pequeno)

**Por quê:** Adicionar multi-tenant depois é dor. Refazer schema de centenas de tabelas, migrations complexas, downtime. Faça desde o começo.

## 2. RLS em vez de schema separado por tenant

**Decisão:** Tudo em 1 schema com filtro RLS. Não criar schema por org.

**Tradeoff:**
- ✅ Migrations simples (1 só)
- ✅ Queries cross-tenant (admin) trivial
- ✅ Performance OK até 10k+ orgs
- ❌ RLS mal configurado vaza dado entre tenants
- ❌ Backup/restore por tenant é mais difícil

**Por quê:** Schema por tenant vira inferno operacional. Testes mostram que RLS bem feito escala bem.

## 3. Supabase em vez de backend custom

**Decisão:** BaaS com Postgres + Auth + Storage + Edge Functions.

**Tradeoff:**
- ✅ Time-to-market 5-10x mais rápido
- ✅ Zero manutenção de infra
- ✅ Custo zero pra MVP
- ❌ Vendor lock-in razoável (mas migrável)
- ❌ Edge functions com timeout de 150s (limita tarefas longas)
- ❌ Preço escalonado em produção grande

**Migrável pra Postgres puro?** Sim. Auth e Storage têm equivalente em outros provedores.

## 4. React + Vite em vez de Next.js

**Decisão:** SPA com Vite. Sem SSR.

**Tradeoff:**
- ✅ Build mais rápido (10-50x)
- ✅ HMR instantâneo
- ✅ Claude Code constrói melhor
- ✅ Menor complexidade
- ❌ Sem SEO server-side (mas área de membros é gated)
- ❌ FCP um pouco maior em primeira carga

**Por quê:** SEO não é necessário (conteúdo logado). SSR adiciona complexidade que não compensa.

## 5. Tailwind 4 + shadcn/ui

**Decisão:** Tailwind utility-first + componentes copiáveis (shadcn).

**Tradeoff:**
- ✅ IA escreve Tailwind 5x mais rápido que CSS-in-JS
- ✅ Componentes shadcn são código no seu repo (sem dependência)
- ✅ Customização total
- ❌ Bundle final grande sem tree-shake bom (mas Tailwind 4 é melhor)
- ❌ JSX fica verboso

**Por quê:** Velocidade de desenvolvimento com IA. shadcn não é dependência, é template.

## 6. Edge Functions Deno em vez de Node

**Decisão:** Edge Functions do Supabase (Deno).

**Tradeoff:**
- ✅ Cold start ~0
- ✅ TypeScript nativo (sem build)
- ✅ Imports HTTPS (sem `node_modules`)
- ✅ Já incluso (sem deploy adicional)
- ❌ Algumas libs Node não funcionam
- ❌ Comunidade menor que Node

**Por quê:** Pra 95% dos casos, Deno serve perfeitamente.

## 7. UAZAPI no início, Cloud API depois

**Decisão:** Começa com UAZAPI (não-oficial), migra pra Cloud API quando escalar.

**Tradeoff:**
- ✅ UAZAPI: setup em 15min, $50/mês
- ✅ Cloud API: zero risco banimento, deliverability superior
- ❌ UAZAPI: risco de banimento (raro)
- ❌ Cloud API: setup leva 3-5 dias, templates fixos

**Por quê:** MVP precisa rodar rápido. Validação primeiro, robustez depois.

## 8. Gemini 2.5 Flash em vez de GPT-4

**Decisão:** Gemini Flash pra IA tutor + processamento de aulas.

**Tradeoff:**
- ✅ 10x mais barato que GPT-4
- ✅ Velocidade superior
- ✅ Qualidade 90% comparável
- ❌ Menos popular (menos exemplos online)
- ❌ Janela de contexto menor que Claude

**Por quê:** Custo escala linear com usuários. Diferença em qualidade não justifica 10x preço.

## 9. AssemblyAI em vez de Whisper

**Decisão:** AssemblyAI pra transcrição de aulas.

**Tradeoff:**
- ✅ Webhook nativo (não precisa polling)
- ✅ Speaker diarization
- ✅ Português excelente
- ❌ Custo (~R$0.30/h) — mas barato pra volume
- ❌ Whisper local é gratuito, mas exige GPU

**Por quê:** Ops simples. Webhook fechou pipeline elegante.

## 10. Auto-geração da jornada (vs manual)

**Decisão:** Sistema gera 7 etapas automaticamente baseado no onboarding.

**Tradeoff:**
- ✅ Aluno não precisa "configurar" jornada
- ✅ CS não precisa criar manualmente
- ✅ Estrutura uniforme (fácil treinar CS)
- ❌ Menos personalização extrema
- ❌ Edge cases não cobertos automaticamente

**Por quê:** Padrão > customização total. CS pode ajustar manualmente quando precisa.

## 11. CS humana, não bot pra travamento

**Decisão:** Quando aluno trava, CS humana entra (via WhatsApp). Não tenta bot resolver.

**Tradeoff:**
- ✅ Resolução real (humano > bot)
- ✅ NPS alto
- ✅ Aprendizado de produto (CS reporta problemas comuns)
- ❌ Não escala infinitamente (precisa de gente)
- ❌ Custo de CS é variável

**Por quê:** Travamento geralmente é emocional (síndrome do impostor, medo de falhar). Bot não resolve isso.

## 12. Versionar conteúdo (lessons) sem deletar antigas

**Decisão:** Aulas antigas ficam no banco, marcadas como `is_active=false`. Nunca deleta.

**Tradeoff:**
- ✅ Histórico preservado (alunos antigos veem o que viram)
- ✅ Rollback fácil
- ❌ Tabela cresce indefinidamente
- ❌ Lógica de "qual versão mostrar?" mais complexa

**Por quê:** Aluno que pagou pra ter aula X não pode perder acesso porque você refez o conteúdo.

## 13. Webhook idempotente (`webhook_log`)

**Decisão:** Toda edge function de webhook checa se evento já foi processado antes de processar.

**Tradeoff:**
- ✅ Tolerante a retry (Stripe, Hotmart, AssemblyAI mandam 2-3x)
- ✅ Sem duplicação de dado
- ❌ Storage extra (1 linha por webhook)
- ❌ Lógica adicional em cada função

**Por quê:** Sem isso, qualquer reentry duplica registros. Inferno pra debug.

## 14. Hooks pre-deploy (segurança)

**Decisão:** Hook git pre-push que aborta se tem chave exposta, RLS faltando, etc.

**Tradeoff:**
- ✅ Bug não chega em produção
- ✅ Aluno aprende boas práticas (vê o erro local)
- ❌ Setup adicional (Husky)
- ❌ Pode ser bypassed com `--no-verify` (mas é explícito)

**Por quê:** Proteção em camadas. Bug que escapa do dev deve ser pego no CI.

## 15. Documentação no próprio repo (não Notion/Confluence)

**Decisão:** Toda doc relevante fica em `.md` no repo (PRD, decisões, runbooks).

**Tradeoff:**
- ✅ Versionado com código
- ✅ IA acessa direto
- ✅ Procura via grep
- ✅ PR review inclui doc
- ❌ Search menos amigável que Notion
- ❌ Não-devs editam menos

**Por quê:** Doc separada do código fica desatualizada. Mantém junto = mantém vivo.

## 16. Tom de voz humano + técnico em paralelo

**Decisão:** Toda mensagem técnica vem em 2 camadas: explicação humana + nome técnico em destaque.

**Tradeoff:**
- ✅ Aluno entende E aprende
- ✅ Reduz fricção de suporte
- ❌ Texto fica mais longo
- ❌ Mais trabalho de redação

**Por quê:** Esconder técnico = aluno fica refém. Mostrar só técnico = aluno desiste. Ambos = aluno cresce.

## 17. Roadmap visual com gates explícitos

**Decisão:** Etapa bloqueada APARECE com cadeado, não some.

**Tradeoff:**
- ✅ Aluno vê o caminho completo
- ✅ Motivacional ("falta isso e isso")
- ❌ Mais espaço de tela
- ❌ Pode parecer "muito" pra alguns

**Por quê:** Esconder cria ansiedade ("o que mais tem?"). Mostrar é transparente.

## 18. Score A-F em vez de %

**Decisão:** Auditoria de segurança e progresso geram score letra (A-F), não porcentagem.

**Tradeoff:**
- ✅ Mais memorável
- ✅ Aluno entende sem pensar
- ❌ Menos preciso (granularidade pior)
- ❌ Score "C" vs "C+" requer regra extra

**Por quê:** Bater o olho > calcular. Letra é universal.

## 19. Acelerador como skill/projeto separado, não embutido

**Decisão:** Aceleradores são ZIPs externos que aluno baixa. Não código embutido na plataforma.

**Tradeoff:**
- ✅ Aluno tem código próprio (autonomia)
- ✅ Versionamento independente
- ✅ Pode usar em outros contextos
- ❌ Plataforma não controla qualidade após download
- ❌ Updates dependem de aluno baixar de novo

**Por quê:** Empoderar aluno > prender em jaula. Acelerador é decolagem, não dependência.

## 20. Stack progressivo (base → implementação → execução)

**Decisão:** Stack tools aparecem em fases. Não joga tudo de uma vez.

**Tradeoff:**
- ✅ Aluno não fica sobrecarregado
- ✅ Aprende cada ferramenta no contexto certo
- ❌ Mais lógica de gating
- ❌ Aluno avançado pode achar lento

**Por quê:** "Aprender 15 tools de uma vez" = nenhum aprende. "Aprender no momento que precisa" = profundidade real.
