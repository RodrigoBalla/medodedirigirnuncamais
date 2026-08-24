# Área de Membros — Clone reutilizável

Cópia da estrutura completa da área de membros (Escola de Condutores) preparada para ser
reaproveitada em **outro negócio**. É o código que está rodando em produção, sem o conteúdo
e sem os segredos deste projeto.

---

## O que tem aqui

```
AREA DE MEMBROS CLONE/
├── README-CLONE.md          ← este arquivo
├── VALORES-PARA-TROCAR.md   ← mapa de tudo que é específico deste negócio
├── app/                     ← o front-end inteiro
│   ├── src/                 ← 192 arquivos (componentes, páginas, hooks, contextos)
│   ├── public/              ← páginas estáticas, service worker, manifest, redirects
│   ├── package.json, vite.config.ts, tailwind.config.ts, tsconfig*, netlify.toml…
│   └── .env.example         ← modelo das variáveis (o .env real NÃO veio junto)
├── supabase/
│   ├── migrations/          ← 30 migrations (recriam o banco do zero)
│   ├── functions/           ← 8 edge functions (Deno)
│   └── config.toml
└── netlify/functions/       ← 2 functions (endpoint de analytics)
```

## Funcionalidades incluídas

**Área da aluna**
- Login/cadastro (Supabase Auth) e página de primeiro acesso com token de uso único
- Biblioteca de cursos, player de aula com retomada de onde parou e marcação automática
  de conclusão. O player abstrai **YouTube, Vimeo, MP4 e Panda Video** no mesmo componente
- Gamificação: XP, níveis, moedas, missões diárias, roleta, ranking, streak
- Comunidade, perfil, cashback em cupom, pesquisa NPS
- Lista de espera (substitui checkout), tela de acesso expirado, PWA com modo offline

**Painel admin**
- Dashboard, alunas, cursos/módulos/aulas, grupos de acesso, comentários
- Notificações em massa, mensagens diretas, analytics, relatórios, tráfego, aproveitamento
- Lista de espera com exportação CSV

**Backend (Supabase)**
- RLS em todas as tabelas com dados de usuário
- Edge functions: webhook de venda, primeiro acesso, e-mails transacionais e de cadência,
  webhook de e-mail, JWT do player, suporte por WhatsApp, keep-alive

---

## Como subir para um negócio novo

### 1. Criar o projeto no Supabase
Crie um projeto novo em [supabase.com](https://supabase.com) e anote a URL, a chave
publishable e o project ref.

### 2. Recriar o banco
```bash
cd supabase
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```
Isso aplica as 30 migrations (tabelas, RLS, funções, triggers).

### 3. Publicar as edge functions
```bash
npx supabase functions deploy NOME_DA_FUNCAO --project-ref SEU_PROJECT_REF
```
> ⚠️ Funções que recebem webhook de fora (venda, e-mail, WhatsApp) precisam de
> `--no-verify-jwt`, senão o provedor externo leva 401.

Depois configure os secrets que elas usam:
```bash
npx supabase secrets set NOME="valor" --project-ref SEU_PROJECT_REF
```

### 4. Configurar o front
```bash
cd app
cp .env.example .env      # preencha com os dados do passo 1
npm install
npm run dev               # abre em http://localhost:8080
```

### 5. Trocar o que é deste negócio
Abra **`VALORES-PARA-TROCAR.md`** — ele lista, com arquivo e linha, cada lugar que tem
nome de marca, WhatsApp, e-mail, link de checkout, UUID de grupo, pixel etc.

### 6. Publicar
```bash
npm run build
npx netlify deploy --prod --dir=dist
```
O `netlify.toml` já traz os redirects e os headers de segurança (CSP inclusa).
> ⚠️ A CSP lista os domínios liberados. Se trocar de player de vídeo ou de checkout,
> precisa liberar o domínio novo lá, senão o navegador bloqueia.

---

## ⚠️ Placeholders que você PRECISA preencher

Alguns arquivos tinham o endereço e a chave do Supabase **deste** negócio escritos direto no
código (fallback, fora do `.env`). Se ficassem, o seu app novo conversaria com o banco errado.
Troquei todos por marcadores:

- `SEU_PROJECT_REF` → o ref do seu projeto Supabase (13 lugares)
- `COLOQUE_AQUI_SUA_CHAVE_ANON` → sua chave anon (4 lugares)

Ache todos assim:
```bash
grep -rn "SEU_PROJECT_REF\|COLOQUE_AQUI_SUA_CHAVE_ANON" app supabase netlify
```

Arquivos afetados: `FirstAccess.tsx`, `SupportChat.tsx`, `NotificationsManager.tsx`,
`TrafegoTab.tsx`, `netlify/functions/eduzz-webhook.ts`, `supabase/config.toml`,
uma migration e três páginas em `public/`.

> A chave anon é pública por natureza (vai no bundle e é protegida por RLS) — o problema não
> era sigilo, era o clone apontar para o banco deste projeto.

---

## O que NÃO veio junto (de propósito)

| Item | Por quê |
|---|---|
| `.env` com as chaves reais | Segredo deste projeto. Use o `.env.example`. |
| Imagens, capas e vídeos das aulas | Conteúdo deste negócio, não estrutura. |
| Vídeos originais (`CURSO ONLINE/`) | Gigabytes de material próprio. |
| Documentos internos (contrato, termo, mapa de memória) | Nada a ver com a estrutura. |
| `node_modules/` e `dist/` | Se regeneram com `npm install` / `npm run build`. |

Alguns arquivos em `app/public/` são páginas one-off deste projeto (`sales.html`,
`trafego.html`, `console-api.html`, `carla.html`, `conectar-whatsapp.html`,
`admin-dash.html`, `mobile-preview.html`). Mantive porque são leves e podem servir de
referência — apague à vontade.

---

## Antes de colocar no ar, confira

1. **RLS ligada em tudo.** É ela que impede uma aluna de ver o conteúdo de outra. Depois do
   `db push`, rode o Advisor do Supabase e confira se não sobrou tabela sem política.
2. **Proteção do vídeo.** O player aceita YouTube "não listado", mas isso não tem DRM nem
   trava de domínio — quem pegar o link assiste fora da plataforma. Para conteúdo pago,
   considere um player com DRM.
3. **Toda mudança é global.** É um único bundle e um único banco: o que você publica aparece
   para todo mundo na hora. Rode `npx tsc --noEmit` antes de subir.
4. **A tabela `waitlist_signups`** (lista de espera) foi criada fora das migrations, direto no
   banco. Se ela não aparecer depois do `db push`, crie na mão — o SQL está no histórico do
   repositório original.
