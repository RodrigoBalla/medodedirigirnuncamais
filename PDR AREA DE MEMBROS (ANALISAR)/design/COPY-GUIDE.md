# Copy Guide — Tom de Voz

## Tom geral

- **Direto** — não enrola
- **Humano** — sem corporativês ("nossa equipe está empenhada em..." → "vou te ajudar")
- **Pragmático** — fala o que importa, sem rodeio
- **Quente mas profissional** — você + nós, sem "querido aluno"

## Ensinar enquanto comunica

Quando aparecer termo técnico, sempre apresenta em **2 camadas**:

```
🚨 CRÍTICO — Service Role Key exposta no front

O que é: a `SUPABASE_SERVICE_ROLE_KEY` é a "chave-mestra" do seu banco — 
quem tem ela ignora qualquer regra de proteção (RLS) e faz tudo.

Onde tá: src/lib/admin.ts:42

Por que é grave: essa chave foi pro browser do cliente. Qualquer um abre 
DevTools → Sources → copia.
```

## Padrões

### Erro

```
❌ Não foi possível salvar
[Tente novamente em alguns segundos]
```

NÃO use:
- "Algo deu errado" (genérico)
- "Erro 500: Internal Server Error" (jargão)
- "Sorry, something went wrong" (idioma errado)

### Sucesso

```
✅ Aula marcada como concluída
```

Curto. Sem "parabéns!", sem emojis exagerados.

### Empty state

```
Nenhum projeto ainda
Vamos começar? Olha as trilhas disponíveis aqui ↓
```

Sempre acompanhado de CTA pro próximo passo.

### Loading

- "Salvando..." (curto, presente contínuo)
- "Carregando seus dados..." 
- "Processando..."

NÃO use:
- "Por favor aguarde" (formal demais)
- "..." sozinho (não dá contexto)

### Confirmação de ação destrutiva

```
Tem certeza?
Você vai apagar a aula "Builder #3". Isso não pode ser desfeito.
[Cancelar]  [Sim, apagar]
```

Mostra:
- O que vai acontecer
- O que se perde
- Botão "destrutivo" diferente visualmente

### CTAs (botões)

✅ "Continuar"
✅ "Ver detalhes"
✅ "Marcar como concluída"
✅ "Falar com Simone"
✅ "Baixar ZIP"
✅ "Agendar call"

❌ "Click aqui"
❌ "Submit"
❌ "OK"
❌ "Send"

## Linguagem específica do programa

### Termos a usar

- **Aluno** (não "usuário", "cliente")
- **Equipe** (não "time")
- **Trilha** ou **Módulo** (não "curso")
- **Aula** (não "lesson", "vídeo")
- **Acelerador** (não "template", "skill")
- **Etapa** (não "step", "fase")
- **Mentoria** (não "encontro")
- **Comunidade** (não "fórum")

### Saudações da jornada (variar por fase)

| Phase | Saudação |
|---|---|
| `welcome` | "Bora começar, {nome}" |
| `learning` | "Semana {X}, vamos {nome}" |
| `implementing` | "Tá quase lá, {nome}" |
| `testing` | "Validando! Bom trabalho" |
| `production` | "{Meta} — concluído. 🎯" |

## Anti-padrões de copy

❌ **"Erro inesperado"** — todo erro é inesperado
❌ **"Nossa plataforma"** — escreve em primeira pessoa
❌ **"Caro cliente"** — corporativês
❌ **Gírias datadas** — "top demais", "show de bola"
❌ **CAIXA ALTA pra ênfase** — agressivo
❌ **!!!! pra ênfase** — nervoso
❌ **Promessa exagerada** — "transforme sua vida em 30 dias!" (gera ceticismo)

## Princípio do "nudge"

Mensagens contextuais que aparecem na jornada (`ContextualNudge`) devem:
1. Ser curtas (1-2 frases)
2. Mencionar o objetivo concreto do aluno (`goal_30_days`)
3. Sugerir próximo passo específico
4. NÃO ser motivacional vazio

❌ "Acredite em você! Você pode!"

✅ "Tá no Builder. Próxima ação: terminar Aula 3 (12min). Depois disso, você desbloqueia a Call com Luiz."

## Tom em diferentes contextos

### Comunicação no produto
**Quente, direto.**

### Email transacional
**Profissional, claro.**

### WhatsApp da CS
**Casual, próximo.** Use "vc" em vez de "você", emojis ocasionais.

### Documentação técnica
**Direto, com humor sutil quando ajuda.** Tipo este PRD.

### Mensagem de erro
**Útil. Empático. Acionável.**

```
❌ "Erro 500"
✅ "Não conseguimos salvar agora. Tenta de novo em 30 segundos. Se persistir, manda pra Simone."
```
