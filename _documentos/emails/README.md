# Templates de Email — Medo de Dirigir Nunca Mais

3 templates HTML com a **identidade visual do app** (navy `#0A1530` + amarelo `#FFD60A` + fitas de advertência).

| Arquivo | Tipo no Supabase | Quando dispara |
|---------|------------------|----------------|
| `confirm-signup.html` | **Confirm signup** | Aluno cria conta na tela "Primeiro acesso" e precisa confirmar o email |
| `reset-password.html` | **Reset password** | Aluno clica em "Esqueci minha senha" |
| `magic-link.html` | **Magic link** | Aluno entra com link mágico (sem senha) |

## 📋 Como aplicar no Supabase Dashboard

1. Acessa: **https://supabase.com/dashboard/project/qkvinhzwiptfobdvsdtr/auth/templates**
2. Pra cada um dos 3 templates:
   - Clica no template correspondente na sidebar (Confirm signup / Reset password / Magic link)
   - **Subject (assunto):** copia do quadro abaixo
   - **Message body (HTML):** apaga tudo e cola o conteúdo do arquivo `.html` correspondente
   - Salva
3. Pronto. Próximo email enviado pelo Supabase já sai com a nova identidade.

## ✉️ Assuntos sugeridos

| Template | Subject |
|----------|---------|
| Confirm signup | `🛞 Confirma seu email pra começar — Medo de Dirigir Nunca Mais` |
| Reset password | `🔑 Sua nova senha está a um clique` |
| Magic link | `⚡ Seu link de acesso ao Medo de Dirigir Nunca Mais` |

## 🎨 Variáveis disponíveis nos templates

Mantenha esses placeholders que o Supabase substitui automaticamente:

- `{{ .ConfirmationURL }}` — link de confirmação/reset/magic (já está nos templates)
- `{{ .Email }}` — email do destinatário (se quiser usar pra "Olá, {{ .Email }}")
- `{{ .SiteURL }}` — URL base do site (configurada em Auth > URL Configuration)

## 🧪 Testar antes de salvar definitivo

Coloca **seu email pessoal** no campo "Send test email" do Supabase Dashboard e clica em enviar.
Verifica em:
- ✅ Gmail (web + app)
- ✅ Outlook (web + app)
- ✅ Apple Mail iOS

## ⚙️ Detalhes técnicos

- HTML usa `<table>` em vez de flexbox/grid pra compatibilidade com **Outlook/Gmail antigo**
- CSS é **inline** em cada elemento (Gmail e Outlook ignoram `<style>` parcialmente)
- Cores hex em hexadecimal completo (`#FFD60A` em vez de variáveis CSS)
- Largura máxima de 560px, responsivo até 320px
- Fontes fallback `'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif`
- Botão CTA usa `box-shadow` que alguns clients descartam — fallback é cor sólida amarela

## 🚨 Importante

Caso queira **mudar a cor** principal:
- `#FFD60A` (amarelo primário) → substituir nas 3 ocorrências por template
- `#0A1530` (navy fundo) → substituir nas ocorrências do BG
- Mantém o gradient amarelo `linear-gradient(135deg,#FFD60A 0%,#F5B800 100%)` em ambos
