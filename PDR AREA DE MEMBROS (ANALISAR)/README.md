# 📘 PRD — Área de Membros para Programas de Aceleração

> Este é o **PRD completo** (Product Requirements Document) de uma Área de Membros pronta pra qualquer programa de aceleração, mentoria, comunidade paga ou formação. Documenta arquitetura, módulos, integrações, regras de negócio e os aprendizados duros de quem rodou em produção com centenas de alunos reais.

> **Pra quem:** fundadores e operadores que querem construir a própria área de membros usando IA (Claude Code, Lovable, Cursor) sem precisar de time de dev sênior.

---

## 🎯 O que é isso

Você cola este PRD no Claude Code (ou similar) e ele constrói a sua área de membros completa do zero — multi-tenant, com onboarding, jornada personalizada, catálogo de conteúdo, comunidade, IA tutor, encontros ao vivo gravados, painel admin, integrações com WhatsApp, Stripe e mais.

Não é um template clonável. É uma **receita aplicável** com decisões justificadas, schemas de banco, lista de edge functions, fluxos de UX e os bugs/armadilhas que valem ouro pra você não se queimar.

---

## 🚀 Como usar este PRD

### Opção 1 — Construir do zero com Claude Code

```bash
# Na pasta do seu projeto novo
mkdir minha-area-membros && cd minha-area-membros
unzip ~/Downloads/area-membros-prd.zip

# Abre o Claude Code
claude

# Cola este prompt:
```

> Quero construir a área de membros descrita no PRD em ./area-membros-prd. Lê todos os arquivos do PRD (começa pelo `prompts/claude-code-master.md`), depois roda o passo a passo de implementação. Use Vite + React + Tailwind + shadcn + Supabase. Aplica as decisões em `aprendizados/DECISOES.md` e cuidado com os bugs em `aprendizados/BUGS-CLASSICOS.md`. Trabalha em fases — completa uma fase, me mostra, e segue pra próxima quando eu aprovar.

### Opção 2 — Usar como referência durante construção

Você já tem um projeto rodando? Use os módulos como referência pra adicionar features específicas:

- Quer adicionar **multi-tenant**? Lê `modules/02-ORGANIZACOES.md` + `database/RLS-PADRAO.md`
- Quer **jornada personalizada**? `modules/04-JORNADA-EXECUCAO.md`
- Quer **IA tutor**? `modules/09-IA-TUTOR.md`

### Opção 3 — Empacotar como teu PRD

Adapta os arquivos pra refletir o **teu** programa específico (nichos, copy, regras). Vira teu próprio acelerador interno.

---

## 📚 Estrutura dos arquivos

```
area-membros-prd/
├── README.md                          ← este arquivo
├── 00-VISAO.md                        ← problema, oportunidade, princípios
├── 01-ARQUITETURA.md                  ← stack escolhida + por quê
├── 02-PERSONAS.md                     ← quem usa: aluno, CS, suporte, admin
├── 03-JORNADA-USUARIO.md              ← do convite ao engajamento contínuo
│
├── modules/                           ← 13 módulos funcionais
│   ├── 01-AUTENTICACAO.md
│   ├── 02-ORGANIZACOES.md
│   ├── 03-ONBOARDING.md
│   ├── 04-JORNADA-EXECUCAO.md         ⭐ coração do produto
│   ├── 05-CATALOGO-CONTEUDO.md
│   ├── 06-ACELERADORES.md
│   ├── 07-ENCONTROS-AO-VIVO.md
│   ├── 08-COMUNIDADE.md
│   ├── 09-IA-TUTOR.md
│   ├── 10-ADMIN.md
│   ├── 11-NOTIFICACOES.md
│   ├── 12-PROGRESS-TRACKING.md
│   └── 13-INTEGRACOES.md
│
├── database/                          ← schemas + RLS
│   ├── ENTIDADES-CORE.md              ← diagrama Mermaid
│   ├── RLS-PADRAO.md                  ← policies multi-tenant
│   └── EXEMPLOS-SCHEMA.sql            ← SQL rodável
│
├── design/                            ← UX e copy
│   ├── PRINCIPIOS.md
│   ├── COMPONENTES.md
│   └── COPY-GUIDE.md
│
├── operacao/                          ← deploy + segurança + obs
│   ├── DEPLOY.md
│   ├── SEGURANCA.md
│   └── OBSERVABILIDADE.md
│
├── aprendizados/                      ← lições da operação real
│   ├── BUGS-CLASSICOS.md              ← 10+ bugs vivenciados + fix
│   └── DECISOES.md                    ← tradeoffs assumidos
│
├── prompts/                           ← prompts pra IA
│   ├── claude-code-master.md          ← prompt principal
│   └── lovable-init.md
│
└── ENV.example                        ← variáveis de ambiente
```

---

## 🛠️ Stack recomendada

- **Frontend:** React 19 + Vite 6 + Tailwind 4 + shadcn/ui + Framer Motion + TanStack Query
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions Deno)
- **Vídeo:** Panda Video (upload, conversão, streaming)
- **WhatsApp:** UAZAPI ou Cloud API oficial Meta
- **IA:** Gemini 2.5 (Pro pra textos longos, Flash pra rápido), Claude (tutor)
- **Transcrição:** AssemblyAI (com webhook callback)
- **Pagamento:** Stripe (recorrente) ou Hotmart/Kiwify (avulso)
- **Email:** Resend ou SMTP do Supabase
- **Hospedagem:** Netlify ou Vercel (deploy via git push)
- **Reuniões:** Zoom (server-to-server JWT)

Ver justificativa de cada escolha em `01-ARQUITETURA.md`.

---

## ⚠️ Antes de começar

### Pré-requisitos

- [ ] Claude Code instalado (https://claude.ai/download)
- [ ] Node.js 20+ e npm
- [ ] Conta Supabase (free tier serve pra começar)
- [ ] Conta Netlify ou Vercel
- [ ] (Opcional) Conta UAZAPI, Panda Video, Stripe — adicione depois conforme precisar

### Tempo estimado

- **MVP funcional** (auth + multi-tenant + uma trilha + admin básico): **3-7 dias** com Claude Code
- **Produto completo** (todos os 13 módulos): **3-6 semanas**

### Custo de operação aproximado

- Supabase Free → suporta 50k usuários ativos
- Netlify Free → 100GB bandwidth/mês
- Gemini Flash → ~R$0,01 por aula processada
- AssemblyAI → ~R$0,30 por hora de transcrição
- UAZAPI → ~R$50/mês plano inicial
- **Custo zero pra MVP de até 100 alunos**, escala linear

---

## 💡 Princípios que guiam este PRD

1. **IA é executor, humano é decisor.** O aluno define o quê; Claude Code constrói. O sistema deve ser construível por quem **não é dev sênior**.
2. **Multi-tenant desde o dia 1.** Vai escalar. Não retrabalhe depois.
3. **RLS é a única proteção real.** Esconder anon_key não protege nada. RLS bem feito sim.
4. **Cada finding técnico vem com nome em destaque.** O aluno aprende vocabulário enquanto usa.
5. **Não esconda gates.** Etapas bloqueadas devem aparecer (visualmente bloqueadas), não sumir. Aluno entende o caminho.
6. **CS humana é tão importante quanto código.** Botão direto pra WhatsApp da equipe em todo lugar relevante.
7. **Linguagem do dono do negócio, não de dev.** "Sua chave-mestra está exposta" antes de "Service role key leak in client bundle".

---

## 🆘 Suporte

- Dúvida sobre o PRD? Abra issue ou pergunte no canal da plataforma onde você baixou.
- Achou erro/contradição? Reporta — o PRD é vivo.
- Quer compartilhar o que construiu com isso? Manda — adicionamos aos cases.

---

## 📜 Licença

Este PRD é compartilhado sob licença permissiva. Você pode:
- ✅ Usar pra construir sua área de membros (comercial ou não)
- ✅ Adaptar e modificar
- ✅ Redistribuir em programas de aceleração próprios

Não pode:
- ❌ Vender o PRD em si como produto
- ❌ Atribuir autoria como sua
