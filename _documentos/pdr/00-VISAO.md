# 00 — Visão do Produto

## Problema que resolve

Programas de aceleração, mentoria, comunidade paga e formação **falham na execução**, não no conteúdo. O aluno compra, assiste 2 aulas, esquece, e o churn vira norma. Plataformas comuns (Hotmart, Kiwify, Eduzz) entregam vídeo — não entregam **execução guiada**.

Áreas de membros tradicionais oferecem:
- ❌ Catálogo de aulas (passivo)
- ❌ Chat genérico
- ❌ Métrica de "% assistido" sem ligação com o objetivo do aluno

O aluno precisa de:
- ✅ Saber **o que fazer agora** quando abre a plataforma
- ✅ **Por que isso importa** pro objetivo dele específico
- ✅ **Quem chamar** se travar (humano real, não bot)
- ✅ Conteúdo + ferramentas + acompanhamento humano integrados

## Princípio central do produto

> O aluno abre a plataforma e sabe **exatamente o que fazer agora, por que importa pra ele, e quem chamar se travar**.

## Métrica que importa

**Taxa de execução** = % de alunos que **terminam** o objetivo definido no onboarding (não só "consumiram conteúdo").

Tudo no produto serve a essa métrica:
- Onboarding define objetivo concreto e mensurável
- Jornada quebra em etapas com tasks executáveis
- Gates condicionais evitam que o aluno se perca
- CS humana intervém em sinais de risco
- Encontros ao vivo retomam quem travou
- IA tutor desbloqueia dúvidas técnicas

## Personas atendidas

1. **Aluno** — dono de negócio (PME, infoprodutor, freelancer) executando um projeto
2. **CS (Customer Success)** — pessoa do time que acompanha alunos, abre WhatsApp, dispara mentorias
3. **Suporte Técnico** — pessoa que destrava problemas técnicos do aluno em call
4. **Admin** — fundador / operador olhando saúde geral, criando conteúdo, gerindo orgs

Detalhe em `02-PERSONAS.md`.

## Tipos de programa que servem

✅ Mentoria/aceleração de empresas (B2B)
✅ Formação técnica com projeto final (ex: bootcamp, MBA, especialização)
✅ Comunidade paga com missões mensais
✅ Programa de transformação pessoal com check-ins
✅ Coaching em grupo com objetivo definido

❌ **Não recomendado pra:** plataformas só de catálogo (Netflix-style), cursos avulsos sem acompanhamento, marketplaces.

## Diferenciais vs alternativas comuns

| Plataforma | O que faz bem | O que falha |
|---|---|---|
| Hotmart/Kiwify | Vendas, área de membros simples | Sem onboarding, sem jornada, sem CS |
| Circle.so | Comunidade | Sem trilha de execução, sem IA |
| Notion + Telegram | Customizável | Não escala, perde aluno na bagunça |
| Khan Academy / Coursera | Conteúdo | Sem CS humano, foco passivo |
| **Esta área de membros** | **Execução guiada com IA + humano** | Precisa construir (ou usar este PRD) |

## Filosofia de produto

### 1. Execução > Consumo

Métrica chave NÃO é "% de conteúdo consumido". É "% de objetivos concluídos". Um aluno que assistiu 100% das aulas sem aplicar é fracasso. Um que assistiu 30% mas concluiu o objetivo é sucesso.

### 2. Humano + IA, não IA sozinha

IA tutor responde dúvida de aula. CS humano resolve travamento de jornada. Suporte técnico real entra em call quando o aluno precisa. **Os 3 são botões diferentes na interface** — não tente que um bot faça tudo.

### 3. Personalização sem complexidade

Cada aluno tem **uma jornada própria** baseada nas respostas do onboarding. Mas a estrutura (7 etapas) é igual pra todos — só o conteúdo de cada etapa muda. Isso evita "paralisia de personalização" e simplifica operação.

### 4. Aluno aprende vocabulário técnico

Cada feedback técnico vem em duas camadas: **explicação humana + nome técnico em destaque**. O aluno sai do programa sabendo conversar com dev sênior.

### 5. Multi-tenant nato, sem retrabalho

Áreas de membros viram empresas-cliente cedo (ex: empresa contrata o programa pra time inteiro). Multi-tenant precisa estar no schema desde o dia 1, não como gambiarra depois. Detalhes em `02-ORGANIZACOES.md`.

### 6. Defaults seguros

- RLS habilitado em toda tabela
- Edge Functions com `verify_jwt: true` por padrão
- Secrets só em servidor (nunca no front)
- Hooks pre-deploy bloqueando push se tiver chave exposta

Detalhes em `operacao/SEGURANCA.md`.

## Anti-padrões a evitar

❌ **"Dashboard com 50 widgets"** — aluno entra e não sabe o que fazer. Foco em UM call-to-action por etapa.

❌ **"Bot que faz tudo"** — IA é boa pra dúvida pontual, ruim pra coaching de jornada. Humano é insubstituível pra travamento emocional/estratégico.

❌ **"Gamificação sem propósito"** — XP, badges e ranking só funcionam se conectados a algo concreto. Sem isso, vira ruído.

❌ **"Trilha linear engessada"** — aluno antigo pode ter feito etapas em ordem diferente. Sistema deve detectar e adaptar (auto-geração).

❌ **"Esconder o que tá bloqueado"** — pior que ver "bloqueado" é não saber que existe. Mostre todas as etapas, marque visualmente as bloqueadas.

❌ **"Métrica de assistido como sucesso"** — desconecta do que importa (execução).

## O que está fora de escopo deste PRD

- Construção de **CRM completo** (use ferramenta existente: HubSpot, Pipedrive, ou monte separado)
- **App mobile nativo** (este PRD assume web-first; mobile pode ser PWA ou wrapper depois)
- **LMS-style com avaliações automáticas** (este PRD é foco em execução, não em testes)
- **Streaming ao vivo** (encontros são gravados depois, não live broadcast)
