# 03 — Jornada do Usuário

> Do convite ao engajamento contínuo. Cada passo descrito com o que o aluno vê, sente e faz.

## Fase 0 — Aquisição (fora da plataforma)

Aluno chega via:
- Anúncio Meta/Google
- Indicação
- Conteúdo orgânico (Instagram, YouTube, podcast)
- Lançamento via afiliado (Hotmart/Kiwify)

→ **paga via Stripe ou checkout do Hotmart/Kiwify**
→ webhook do gateway dispara `send-organization-invite` Edge Function
→ aluno recebe email com magic link

## Fase 1 — Primeiro acesso (Dia 0)

### Step 1.1: Email/WhatsApp de boas-vindas
- Email com magic link `https://app.com/convite/<token>`
- WhatsApp com mesmo link (se passou telefone no checkout)

### Step 1.2: Aluno clica no link
- Página `/convite/:token`
- Mostra "Bem-vindo ao [Programa]. Crie sua senha pra começar."
- Form: senha + confirmação
- Submit → cria conta no Supabase Auth + `organization_members` + redirecionar pra `/onboarding`

### Step 1.3: Onboarding conversacional
- 7 passos perguntando: empresa, segmento, faturamento, objetivo 30 dias, gargalo, ferramentas atuais, horas/semana
- Cada passo é uma tela só (não wizard de 1 página)
- IA gera resumo no final ("Entendi: você quer X, em Y semanas, focando em Z")
- Salva em `onboarding_sessions` e dispara `onboarding-webhook`
- Webhook gera `user_journey` v3 com 7 etapas personalizadas + tracks (Starter, Builder, Acelerador escolhido)

### Step 1.4: Welcome screen
- "Sua jornada está pronta"
- CTA grande: "Ver minha trilha"
- Avatares da equipe (Simone CS + Luiz Tech) + WhatsApp deles
- Click no CTA → `/minha-jornada`

**Tempo estimado Step 1:** 8-12 minutos do email à jornada montada.

## Fase 2 — Primeira semana (Dias 1-7)

### Foco: ativação técnica e fundamentos

### O que o aluno vê em `/minha-jornada`
- Header personalizado: "Bora começar, [Nome]. Meta em [X] dias."
- Card "Foco da Jornada": meta 30d + meta 90d + gargalo
- Card "Visão da semana": plano calculado pelas horas disponíveis
- Roadmap: 7 etapas (Onboarding ✅ → Starter ▶️ → Builder 🔒 → Call → Acelerador → Implementação → Meta)
- Step Atual (Starter): imagem + descrição + CTA "Ir pra aula"

### O que faz
1. Click "Ir pra aula" → `/trilhas/starter/aula/<primeira-aula-incompleta>`
2. Assiste vídeo, anotações, tutor IA disponível
3. Aula auto-marca completa quando >= 95% ou faltam <=5min do final
4. Volta pra jornada → próxima aula desbloqueada
5. Após terminar todas aulas do Starter → mission "Starter" auto-completa → Builder desbloqueia

### Pontos de fricção comuns
- Aluno não sabe o que é "anon key" / "Supabase" / "Edge function" → tutor IA explica
- Trava na configuração de conta (Supabase) → botão "Suporte com Luiz" → modal agenda call

### Sinais que CS deve agir
- Aluno fez onboarding mas não acessou em 48h → mensagem proativa
- Aluno parou no meio do Starter por 3 dias → check-in WhatsApp

## Fase 3 — Construção (Dias 8-21)

### Foco: builder + call de mentoria + acelerador

### Builder
- 6 aulas focadas em construir o primeiro fluxo
- Aluno cria projeto real (não só assiste)
- Task com `evidence_required` → pede screenshot/link → CS valida

### Call com Suporte
- Etapa "Call de Implementação" desbloqueia após Starter+Builder
- Aluno clica "Agendar call" → modal mostra slots da semana → escolhe
- 30min com Suporte Técnico
- Conversa: como tá indo, o que travou, definir aceleradores
- Suporte adiciona stack tools recomendadas pra aluno na call
- Suporte registra `cs_interaction` (tipo `mentoria`)

### Acelerador
- Aluno baixa template/skill do acelerador escolhido
- Roda no Claude Code
- Constrói o produto/automação alvo

## Fase 4 — Implementação (Dias 22-30)

### Foco: deploy + testes + ajustes

### Tasks típicas
- "Base implementada do projeto" (`evidence_required`)
- "Testar com dados reais" (`self_check`)
- "Ajustar com base nos testes" (`self_check`)
- "Validar com suporte técnico" (`cs_validation`)

### Riscos
- Aluno trava no deploy → "Suporte com Luiz"
- Aluno está perfeccionista, não publica → CS pressiona pra colocar no ar mesmo "feio"

## Fase 5 — Meta (Dia 30)

### Foco: validar resultado real

### Tasks
- "Ativar agente em produção" (`evidence_required`)
- "Monitorar por 3 dias" (`self_check`)
- "Apresentar resultados" (`cs_validation` — call final com CS)

### Output
- Aluno registra vitória em `user_victories` (ex: "+47 leads gerados em 3 dias")
- CS valida e marca jornada concluída
- Phase muda pra `production` no `user_journeys`

## Fase 6 — Engajamento contínuo (Dia 30+)

### Pós-meta, aluno fica na plataforma

- Comunidade ativa (canais)
- Encontros ao vivo recorrentes (semanais)
- Novidades de novos aceleradores
- IA tutor sempre disponível
- Suporte técnico pra novos travamentos

### Loop de retenção
- Nova versão de acelerador sai → notifica via WhatsApp grupo + Novidades pinadas
- Aluno volta, baixa, implementa
- Vira vitória nova

### Renovação (se aplicável)
- 60-90 dias antes de vencer plano: CS proativa propõe upgrade/renovação
- Métricas de uso recente alimentam pitch

## Fluxos cruzados

### Fluxo "Aluno trava"

```
Aluno trava em task X
  ↓
Sistema detecta (não conclui task em N dias OU não acessa em 7 dias)
  ↓
Notificação proativa via WhatsApp pra CS
  ↓
CS manda mensagem: "Como tá indo? Vi que travou em Y."
  ↓
Aluno responde:
  - "Tá tranquilo, retomo amanhã" → CS marca check-in OK
  - "Tô travado em Z" → CS abre call ou cria help_request
  ↓
Resolução → cs_interaction registrado → métrica de saúde melhora
```

### Fluxo "Aluno completa task técnica que precisa de validação"

```
Aluno marca task com validation_type='evidence_required' como pronta
  ↓
Modal abre: "Cola URL ou screenshot do que você fez"
  ↓
Aluno cola
  ↓
Task fica em status "pending_validation"
  ↓
CS recebe notificação no admin
  ↓
CS olha evidência:
  - OK → marca como validated → task completa → mission progresso
  - Não OK → comenta o que falta → manda WhatsApp pro aluno
```

### Fluxo "Aluno acessa pela 1ª vez depois de muito tempo"

```
Aluno abre /minha-jornada (último acesso há 30 dias)
  ↓
Detecta inatividade longa
  ↓
Mostra modal: "Bem-vindo de volta. Vamos retomar de onde parou?"
  ↓
CTA grande pra próxima task
  ↓
Notifica CS em background (pra check-in de retomada)
```

## Pontos de contato com humano

| Momento | Quem | Como |
|---|---|---|
| Convite inicial | Email automatizado | (ninguém) |
| Boas-vindas | CS humana | WhatsApp manual no primeiro dia |
| Check-in semanal | CS humana | WhatsApp |
| Travamento detectado | CS humana | WhatsApp proativo |
| Call de implementação (Etapa 3) | Suporte Técnico | Zoom 30-60min |
| Validação de evidência | CS humana | Comentário in-app + WhatsApp |
| Apresentação final (Etapa 6) | CS humana | Call final 30min |
| Pós-programa | CS + Comunidade | WhatsApp grupo + posts |

**Princípio**: humano é insubstituível em momentos emocionais (travamento, retomada, validação de meta). IA cobre dúvidas técnicas pontuais.

## Pontos de contato com IA

| Momento | IA pra quê |
|---|---|
| Onboarding | Gerar resumo personalizado, sugerir acelerador |
| Aula | Tutor IA pra dúvida em tempo real |
| Auto-geração de jornada | Criar 7 etapas com base em onboarding |
| Geração de conteúdo de aula | Steps, FAQs, mindmap, transcript limpo |
| Geração de PDF estilo consultoria | Pra aceleradores |
| Análise de progresso | Identificar padrões de risco (futuro) |

## Próximo

Lê `modules/01-AUTENTICACAO.md` — primeiro módulo a construir.
