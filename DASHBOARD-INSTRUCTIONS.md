# Dashboard de Comportamento — Reconstrução Completa

Documento único e auto-contido para reproduzir, do zero, o painel admin de
analytics em tempo real do Lobo Studio. **Frontend + Backend + Ops.**

Convenção do documento:

- 🟢 **Você (ou o Claude Code)** consegue fazer — código, edição de arquivos,
  comandos no terminal.
- 🔴 **Cowork** precisa fazer — qualquer coisa que envolva clicar em painel
  externo (Netlify UI, Meta Business Manager, Google Analytics, registrar
  domínio). Cada item desses traz um **prompt pronto** para você colar no
  Cowork.

**Stack final**: HTML/CSS/JS vanilla + 2 Netlify Functions + Netlify Blobs.
Zero frameworks, zero build step, zero dependências de chart.

---

## PARTE A · FRONTEND DO PAINEL

### A.1 🟢 Tokens de design (`:root`)

```css
:root {
  --gold:    #FECE08;
  --dark:    #0a0a0a;
  --dark-2:  #141414;
  --light:   #ffffff;
  --muted:   rgba(255,255,255,.72);
  --muted-2: rgba(255,255,255,.5);

  --font-h: "Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-b: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;

  --radius:    10px;
  --radius-lg: 18px;
}
body { background: var(--dark); color: var(--light); font-family: var(--font-b); }
```

### A.2 🟢 Carregamento das fontes (no `<head>`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
```

### A.3 🟢 Container do painel (modal full-screen)

```html
<div class="admin is-open" id="admin">
  <div class="admin__inner">
    <div class="admin__header">
      <div>
        <div class="admin__title">Painel admin</div>
        <div class="admin__sub">Comportamento dos visitantes</div>
      </div>
    </div>

    <div class="admin__body">
      <!-- live pill (A.7) + KPIs (A.5) + cards (A.4 e seguintes) -->
    </div>
  </div>
</div>
```

```css
.admin {
  position: fixed; inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 24px;
  overflow-y: auto;
}
.admin__inner {
  max-width: 1080px; margin: 0 auto;
  background: var(--dark-2);
  border: 1px solid rgba(254,206,8,.18);
  border-radius: var(--radius-lg);
  box-shadow: 0 30px 80px rgba(0,0,0,.6);
  overflow: hidden;
}
.admin__header {
  padding: 22px 28px;
  background: linear-gradient(135deg, rgba(254,206,8,.1), rgba(254,206,8,.02));
  border-bottom: 1px solid rgba(254,206,8,.15);
}
.admin__title {
  font-family: var(--font-h);
  font-weight: 900; font-size: 1.4rem;
  color: var(--gold); letter-spacing: -.01em;
}
.admin__sub { font-size: .82rem; color: var(--muted-2); margin-top: 2px; }

.admin__body {
  padding: 24px 28px 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
}
@media (max-width: 800px) { .admin__body { grid-template-columns: 1fr; } }

.admin__col {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(254,206,8,.08);
  border-radius: 14px;
  padding: 22px;
}
.admin__col--full { grid-column: 1 / -1; }
.admin__h-block { margin-bottom: 16px; }
.admin__h3 {
  font-family: var(--font-h); font-weight: 800;
  font-size: .98rem; color: var(--light);
  margin: 0 0 4px;
}
.admin__h3-sub {
  font-size: .78rem; color: var(--muted-2);
  line-height: 1.4; margin: 0;
}
.admin__empty {
  font-size: .82rem; color: var(--muted-2); font-style: italic;
}
```

### A.4 🟢 O **gráfico principal** — barra horizontal

Componente reusado em funil, UTMs, diagnóstico e vídeos.

```css
.admin__bars { display: flex; flex-direction: column; gap: 10px; }
.admin__bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: .85rem;
}
.admin__bar-label {
  color: var(--muted);
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: .78rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.admin__bar-num {
  font-family: var(--font-h); font-weight: 800;
  font-size: .9rem; color: var(--gold);
  min-width: 36px; text-align: right;
}
.admin__bar-track {
  grid-column: 1 / -1;
  height: 8px;
  background: rgba(255,255,255,.05);
  border-radius: 4px;
  overflow: hidden;
  margin-top: -4px;
}
.admin__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold) 0%, #ff9d00 100%);
  border-radius: 4px;
  transition: width .35s ease;
}
```

```js
function renderBars(elId, items) {
  const el = document.getElementById(elId);
  if (!items.length) {
    el.innerHTML = '<div class="admin__empty">Sem dados ainda.</div>';
    return;
  }
  // Largura proporcional ao MAIOR item (não ao total)
  const max = Math.max(...items.map(i => i.value));
  el.innerHTML = items.map(i => {
    const pct = max ? (i.value / max) * 100 : 0;
    return `
      <div>
        <div class="admin__bar">
          <span class="admin__bar-label">${i.name}</span>
          <span class="admin__bar-num">${i.value}</span>
        </div>
        <div class="admin__bar-track">
          <div class="admin__bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}
```

### A.5 🟢 KPIs (números grandes)

```html
<div class="admin__stats" id="admin-stats">
  <div class="admin__stat">
    <div class="admin__stat-num">128</div>
    <div class="admin__stat-lbl">Visitas no site</div>
  </div>
</div>
```

```css
.admin__stats {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 600px) { .admin__stats { grid-template-columns: repeat(2, 1fr); } }
.admin__stat {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(254,206,8,.1);
  border-radius: 14px;
  padding: 18px 20px;
}
.admin__stat-num {
  font-family: var(--font-h); font-weight: 900;
  font-size: 2rem; color: var(--gold);
  line-height: 1.05; letter-spacing: -.02em;
}
.admin__stat-lbl {
  font-size: .74rem; color: var(--muted-2);
  letter-spacing: .08em; text-transform: uppercase;
  margin-top: 6px;
  font-family: var(--font-h); font-weight: 700;
}
```

### A.6 🟢 Tiles de Web Vitals

```html
<div class="admin__vitals">
  <div class="admin__vital">
    <div class="admin__vital-name">Velocidade de carregar</div>
    <div class="admin__vital-value">2,1s</div>
    <div class="admin__vital-rating admin__vital-rating--good">Bom</div>
  </div>
</div>
```

```css
.admin__vitals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.admin__vital {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(254,206,8,.08);
  border-radius: 12px;
  padding: 14px 16px;
}
.admin__vital-name {
  font-size: .72rem; color: var(--muted-2);
  font-family: var(--font-h); font-weight: 700;
}
.admin__vital-value {
  font-family: var(--font-h); font-weight: 800;
  font-size: 1.3rem; color: var(--light);
  margin: 6px 0 8px;
}
.admin__vital-rating {
  display: inline-block; padding: 3px 10px; border-radius: 100px;
  font-size: .68rem; font-weight: 700;
  font-family: var(--font-h); letter-spacing: .04em;
}
.admin__vital-rating--good { background: rgba(34,197,94,.15);  color: #4ade80; }
.admin__vital-rating--ni   { background: rgba(254,206,8,.15);  color: var(--gold); }
.admin__vital-rating--poor { background: rgba(239,68,68,.15);  color: #f87171; }
.admin__vital-rating--none { background: rgba(255,255,255,.05); color: var(--muted-2); }
@media (max-width: 600px) { .admin__vitals { grid-template-columns: 1fr; } }
```

### A.7 🟢 Pill "Ao vivo" (com auto-refresh)

```html
<div class="admin__live">
  <span class="admin__live-dot"></span>
  <span>Ao vivo · atualizado <span id="admin-updated-at">agora</span></span>
</div>
```

```css
.admin__live {
  display: inline-flex; align-items: center; flex-wrap: wrap;
  gap: 10px; padding: 10px 14px; margin-bottom: 18px;
  background: rgba(34, 197, 94, .06);
  border: 1px solid rgba(34, 197, 94, .25);
  border-radius: 100px;
  font-size: .78rem; color: var(--muted);
}
.admin__live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #22c55e;
  animation: livePulse 1.6s ease-out infinite;
}
@keyframes livePulse {
  0%   { box-shadow: 0 0 0 0    rgba(34,197,94,.55); }
  70%  { box-shadow: 0 0 0 10px rgba(34,197,94,0);   }
  100% { box-shadow: 0 0 0 0    rgba(34,197,94,0);   }
}
.admin__live--error {
  background: rgba(239, 68, 68, .08);
  border-color: rgba(239, 68, 68, .3);
  color: #f87171;
}
.admin__live--error .admin__live-dot { background: #f87171; animation: none; }
@media (max-width: 640px) {
  .admin__live {
    display: flex; width: 100%; border-radius: 14px;
    justify-content: space-between; padding: 12px 14px; font-size: .82rem;
  }
}
```

```js
// Refresh automático: 4s + visibilitychange + focus
let lastRender = Date.now();
const updatedAtEl = document.getElementById('admin-updated-at');

function updateTimestamp() {
  const s = Math.floor((Date.now() - lastRender) / 1000);
  if      (s < 5)  updatedAtEl.textContent = 'agora';
  else if (s < 60) updatedAtEl.textContent = 'há ' + s + ' s';
  else             updatedAtEl.textContent = 'há ' + Math.floor(s/60) + ' min';
}
setInterval(updateTimestamp, 1000);

async function refreshDashboard() {
  // (sua função renderStats, renderBars, etc — preencha)
  lastRender = Date.now();
  updateTimestamp();
}
setInterval(refreshDashboard, 4000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshDashboard();
});
window.addEventListener('focus', refreshDashboard);
```

### A.8 🟢 Bloco "Diagnóstico" (perguntas com barras agrupadas)

```html
<div class="admin__diag" id="admin-diag">
  <div class="admin__diag-q">
    <div class="admin__diag-q-text">
      1. Quantas pessoas vão participar?
      <span class="admin__diag-total">(42 respostas)</span>
    </div>
    <!-- barras (use o componente do A.4) -->
  </div>
</div>
```

```css
.admin__diag { display: grid; grid-template-columns: 1fr 1fr; gap: 28px 36px; }
.admin__diag-q { display: flex; flex-direction: column; gap: 8px; }
.admin__diag-q-text {
  font-family: var(--font-h); font-weight: 800;
  font-size: .82rem; color: var(--gold);
  letter-spacing: .02em; margin-bottom: 6px;
}
.admin__diag-total {
  font-family: var(--font-b);
  font-size: .72rem; color: var(--muted-2);
  font-weight: 400; margin-left: 6px;
}
@media (max-width: 800px) { .admin__diag { grid-template-columns: 1fr; gap: 22px; } }
```

### A.9 🟢 Lista "Atividade recente"

```html
<div class="admin__recent" id="admin-recent">
  <div class="admin__recent-item">
    <span class="admin__recent-name">pagina_visitada</span>
    <span class="admin__recent-meta">há 12s</span>
  </div>
</div>
```

```css
.admin__recent {
  max-height: 320px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
}
.admin__recent::-webkit-scrollbar { width: 6px; }
.admin__recent::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.08); border-radius: 3px;
}
.admin__recent-item {
  display: flex; gap: 12px; align-items: center;
  padding: 8px 10px; border-radius: 8px;
  font-size: .8rem; transition: background .15s ease;
}
.admin__recent-item:hover { background: rgba(255,255,255,.03); }
.admin__recent-name {
  flex: 1; min-width: 0; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.admin__recent-meta {
  font-size: .72rem; color: var(--muted-2); white-space: nowrap;
}
```

```js
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'há ' + s + 's';
  if (s < 3600)  return 'há ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + 'h';
  return 'há ' + Math.floor(s / 86400) + 'd';
}
```

---

## PARTE B · BACKEND (eventos + agregação)

O dashboard só funciona se houver dados. Estes 3 arquivos fazem a coleta,
o armazenamento e a agregação.

### B.1 🟢 Auth gate do painel (`/#admin`)

Cole **antes** de qualquer JS do painel. A senha **não** vai no código —
só o hash SHA-256 dela.

```js
const ADMIN_EMAIL    = 'voce@seudominio.com';
const ADMIN_SALT     = 'qualquer-string-fixa';   // muda quando trocar senha
const ADMIN_PWD_HASH = 'COLAR_HASH_AQUI';        // SHA-256(salt + senha)

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim().toLowerCase();
  const pwd   = document.getElementById('admin-password').value;
  const hash  = await sha256Hex(ADMIN_SALT + pwd);
  if (email === ADMIN_EMAIL && hash === ADMIN_PWD_HASH) {
    sessionStorage.setItem('lobo_admin_auth_v1', '1');
    sessionStorage.setItem('lobo_admin_token', hash);   // bearer pro server
    showDashboard();
  } else {
    alert('Credenciais inválidas');
  }
});
```

> ⚠️ Nunca commite a senha em texto puro. Gere o hash localmente:
> `echo -n "qualquer-string-fixaSUASENHA" | shasum -a 256` (Mac/Linux) ou no
> Node: `crypto.createHash('sha256').update('qualquer-string-fixaSUASENHA').digest('hex')`.

### B.2 🟢 Helper `Track` (coleta no front)

Salva eventos em `localStorage` **e** dispara cópia pro servidor (Netlify
Function). Cole no final do `<body>`.

```html
<script>
window.Track = (function () {
  const KEY = 'lobo_admin_v1';
  const SESSION_KEY = 'lobo_session_id';

  function isAdminAuthed() {
    try { return sessionStorage.getItem('lobo_admin_auth_v1') === '1'; }
    catch (e) { return false; }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }
  function sessionId() {
    let id;
    try { id = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!id) {
      id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      try { sessionStorage.setItem(SESSION_KEY, id); } catch (e) {}
    }
    return id;
  }

  // Espelha cada evento pro servidor (fire-and-forget)
  function mirror(name, meta) {
    try {
      fetch('/.netlify/functions/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          name, meta: meta || null,
          session: sessionId()
        })
      }).catch(() => {});
    } catch (e) {}
  }

  function event(name, meta) {
    if (isAdminAuthed()) return;          // ignora as próprias visitas do admin
    mirror(name, meta);
    const d = load();
    if (!d.events) d.events = {};
    if (!d.recent) d.recent = [];
    d.events[name] = (d.events[name] || 0) + 1;
    d.recent.unshift({ name, meta: meta || null, ts: Date.now() });
    if (d.recent.length > 100) d.recent.length = 100;
    save(d);
  }

  function init() {
    if (isAdminAuthed()) return;
    const d = load();
    if (!d.sessions) d.sessions = [];
    const sid = sessionId();
    if (!d.sessions.includes(sid)) {
      d.sessions.push(sid);
      d.events = d.events || {};
      d.events['pagina_visitada'] = (d.events['pagina_visitada'] || 0) + 1;
      d.recent = d.recent || [];
      d.recent.unshift({ name: 'pagina_visitada', meta: null, ts: Date.now() });
      mirror('pagina_visitada', null);
    }
    save(d);
  }

  init();
  return { event, load, clear: () => localStorage.removeItem(KEY) };
})();

// Como usar:
//   window.Track.event('viu_secao_planos');
//   window.Track.event('clique_em_plano', { plano: 'Pro' });
//   window.Track.event('lead_formulario', { plano: 'Pro' });
</script>
```

### B.3 🟢 Netlify Function — `events.js`

Append-log de eventos com agregação on-read. Salve em
`netlify/functions/events.js`.

```js
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'events_v1';
const LOG_KEY = 'log';
const MAX_LOG = 5000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
function isAuthorized(event) {
  const expected = process.env.ADMIN_PWD_HASH;
  if (!expected) return false;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1].trim().toLowerCase() === expected.trim().toLowerCase();
}
function openStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  return (siteID && token)
    ? getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' })
    : getStore(STORE_NAME);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(), body: '' };
  const store = openStore();

  if (event.httpMethod === 'POST') {
    let p;
    try { p = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: corsHeaders(), body: 'bad json' }; }
    const name = (p.name || '').toString().trim();
    if (!name) return { statusCode: 400, headers: corsHeaders(), body: 'name required' };
    const record = {
      ts: Date.now(),
      name,
      meta: p.meta || null,
      session: p.session || null
    };
    const log = (await store.get(LOG_KEY, { type: 'json' })) || { items: [] };
    log.items.unshift(record);
    if (log.items.length > MAX_LOG) log.items.length = MAX_LOG;
    await store.setJSON(LOG_KEY, log);
    return { statusCode: 200, headers: corsHeaders(), body: '{"ok":true}' };
  }

  if (event.httpMethod === 'GET') {
    if (!isAuthorized(event)) return { statusCode: 401, headers: corsHeaders(), body: 'unauthorized' };
    const log = (await store.get(LOG_KEY, { type: 'json' })) || { items: [] };
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...aggregate(log.items) })
    };
  }

  if (event.httpMethod === 'DELETE') {
    if (!isAuthorized(event)) return { statusCode: 401, headers: corsHeaders(), body: 'unauthorized' };
    await store.setJSON(LOG_KEY, { items: [] });
    return { statusCode: 200, headers: corsHeaders(), body: '{"ok":true}' };
  }
  return { statusCode: 405, headers: corsHeaders(), body: 'method not allowed' };
};

function aggregate(items) {
  const events = {}, sessions = new Set();
  for (const ev of items) {
    if (!ev || !ev.name) continue;
    events[ev.name] = (events[ev.name] || 0) + 1;
    if (ev.session) sessions.add(ev.session);
  }
  const recent = items.slice(0, 200).map(it => ({ name: it.name, meta: it.meta, ts: it.ts }));
  return { events, sessions: [...sessions], recent };
}
```

### B.4 🟢 Buscar dados do servidor no painel

```js
let serverData = null;
async function fetchServerEvents() {
  const token = sessionStorage.getItem('lobo_admin_token') || '';
  if (!token) return null;
  try {
    const res = await fetch('/.netlify/functions/events', {
      headers: { 'Authorization': 'Bearer ' + token },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.ok ? j : null;
  } catch { return null; }
}

async function refreshDashboard() {
  const fresh = await fetchServerEvents();
  if (fresh) serverData = fresh;
  const data = serverData || (window.Track && window.Track.load()) || {};
  // chame todos os render*() aqui:
  renderStats(data);
  renderBars('admin-funnel', funnelFrom(data));
  // ... etc
  lastRender = Date.now();
}
```

### B.5 🟢 Configuração do projeto Netlify

`netlify.toml` na raiz:

```toml
[functions]
  directory = "netlify/functions"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

`package.json` na raiz:

```json
{
  "name": "seu-projeto",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@netlify/blobs": "^8.1.0"
  }
}
```

### B.6 🟢 `.gitignore`

```
node_modules/
.netlify/
.env
.env.local
deploy-*.zip
```

---

## PARTE C · OPS (precisam de Cowork ou ação humana)

Tudo que está nesta parte envolve clicar em painel externo. Para cada item,
copie o **prompt** e cole no Cowork.

### C.1 🔴 Criar projeto no Netlify

**Por que Cowork:** o Claude Code não tem credenciais da sua conta Netlify
nem consegue criar uma conta nova com seu nome.

**Prompt para o Cowork:**

```
Preciso criar um novo projeto no Netlify. Acesse
https://app.netlify.com/teams e:

1. Se eu não tiver conta, crie uma com o e-mail [seu-email]
2. Crie um novo "site" chamado "[nome-do-projeto]"
   (Add new site → Import from Git OU Deploy manually)
3. Conecte o repositório [URL do GitHub] na branch main
4. Em Site settings → Build & deploy → Build command: deixe VAZIO
   Publish directory: . (ponto)
5. Me retorne:
   - O Site ID (Settings → Site information → Site ID)
   - O Account ID (Settings → General → Team)
   - A URL do site (algo .netlify.app)
```

### C.2 🔴 Gerar token de acesso aos Netlify Blobs

**Por que Cowork:** o token sai do dashboard `app.netlify.com/user/applications`.

**Prompt para o Cowork:**

```
No Netlify, gere um Personal Access Token para mim acessar Netlify Blobs:

1. Vá em https://app.netlify.com/user/applications
2. Clique em "New access token"
3. Nome: "blobs-prod"
4. Sem expiração
5. Copie o token gerado (começa com nfp_…)
6. Me retorne o token + o Site ID do projeto

⚠️ Não compartilhe o token em chat público — me passe direto.
```

### C.3 🔴 Configurar variáveis de ambiente no Netlify

**Por que Cowork:** entrar no painel e digitar valores.

**Prompt para o Cowork:**

```
Configure estas environment variables no Netlify:
https://app.netlify.com/sites/[SITE_NAME]/settings/env

| Nome                       | Valor                                      |
|----------------------------|--------------------------------------------|
| NETLIFY_BLOBS_SITE_ID      | [SITE_ID que você me deu no passo C.1]     |
| NETLIFY_BLOBS_TOKEN        | [TOKEN gerado no passo C.2]                |
| ADMIN_PWD_HASH             | [HASH SHA-256 que vou te mandar]           |

Marque todas como "Sensitive" (não exibir no log).
Após salvar, dispare um redeploy: Deploys → Trigger deploy → Deploy site.
```

> 🟢 **Para gerar o `ADMIN_PWD_HASH` localmente** (sem precisar do Cowork):
> ```bash
> # Mac/Linux:
> echo -n "minha-saltSENHADESEJADA" | shasum -a 256 | cut -d' ' -f1
> # Windows PowerShell:
> $s="minha-saltSENHADESEJADA"; [BitConverter]::ToString(
>   [System.Security.Cryptography.SHA256]::Create().ComputeHash(
>     [System.Text.Encoding]::UTF8.GetBytes($s))) -replace '-','' | % ToLower
> ```

### C.4 🔴 (Opcional) Configurar Meta Pixel + CAPI

Se você quiser tracking de conversões pro Meta Ads.

**Prompt para o Cowork — pegar o Pixel ID:**

```
Acesse https://business.facebook.com/events_manager2/list/dataset
e me retorne:

1. O Pixel ID (número de 15 dígitos) do dataset chamado "[nome-do-pixel]"
2. Se não existir um pixel, crie um:
   - Dataset → Connect data sources → Web → Meta Pixel
   - Nome: "[seu-projeto] - Web"
   - URL do site: https://[seu-site].netlify.app
   - Me retorne o ID gerado
```

**Prompt para o Cowork — gerar o Access Token CAPI:**

```
No mesmo Events Manager, gere um Access Token CAPI:

1. Vá no Pixel [PIXEL_ID]
2. Settings → Conversions API → Generate access token
3. Marque "Never expires"
4. Copie o token (começa com EAAB… ou EAA…)
5. Me retorne o token

⚠️ Token longo, ~200 caracteres. Não exibe em chat público.
```

### C.5 🔴 (Opcional) Pegar o ID do Google Analytics 4

**Prompt para o Cowork:**

```
Em https://analytics.google.com:

1. Selecione a propriedade "[nome-do-projeto]"
   (se não existir, crie uma "GA4 Property" para https://[seu-site].netlify.app)
2. Admin → Data Streams → escolha o stream Web
3. Me retorne o "Measurement ID" (formato G-XXXXXXXXXX)
```

### C.6 🔴 (Opcional) Conectar domínio próprio

**Prompt para o Cowork:**

```
Conecte o domínio [seudominio.com] ao site Netlify [SITE_ID]:

1. https://app.netlify.com/sites/[SITE_NAME]/settings/domain
2. Add custom domain → [seudominio.com]
3. Netlify vai mostrar 4 nameservers (dns1.p01… etc) OU
   uma instrução de CNAME. Me retorne EXATAMENTE qual a Netlify pediu.
4. Eu vou aplicar isso no meu registrar (Registro.br / GoDaddy / etc).
5. Depois confirme que o SSL foi emitido (Domain settings → HTTPS → "Verify").
```

### C.7 🔴 (Opcional) Webhook de leads no Botconversa / WhatsApp

**Prompt para o Cowork:**

```
Em https://app.botconversa.com.br:

1. Crie um novo webhook de automação chamado "Captura LP"
2. Tipo: HTTP POST, Conteúdo: JSON
3. Campos esperados (configure mapping):
   - "nome"          → Nome do lead
   - "whatsapp"      → Telefone (E.164 — ex: +5511999998888)
   - "data_desejada" → Data
   - "plano"         → Plano escolhido
   - "cupom"         → Cupom aplicado
   - "fonte"         → Origem
4. Me retorne a URL do webhook (formato:
   https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/...)
5. Configure resposta automática: "Recebemos, te chamamos em até 5 min."
```

---

## PARTE D · DEPLOY (loop de execução)

Sempre que mudar código:

```bash
git add .
git commit -m "feat: …"
git push origin main
netlify deploy --prod --dir .
```

A primeira vez que rodar `netlify deploy` no terminal, ele pede pra logar
(`netlify login`) e linkar o projeto local com o site remoto
(`netlify link`). Depois disso, tudo é automático.

**Se `netlify deploy` falhar com "Error while running build":**
remova `node_bundler = "esbuild"` do `netlify.toml` (se existir) e tente
de novo. As Functions do dashboard precisam do auto-detect de contexto
do `@netlify/blobs`, que esbuild quebra.

---

## PARTE E · TESTES MANUAIS

Depois de tudo no ar, valide:

1. **Front grava evento → server recebe**
   ```bash
   curl -X POST https://[seu-site].netlify.app/.netlify/functions/events \
     -H "Content-Type: application/json" \
     -d '{"name":"teste_curl","session":"s_test"}'
   ```
   Resposta esperada: `{"ok":true}`

2. **Admin lê o agregado**
   ```bash
   curl https://[seu-site].netlify.app/.netlify/functions/events \
     -H "Authorization: Bearer [ADMIN_PWD_HASH]"
   ```
   Resposta esperada: JSON com `events`, `sessions`, `recent`.

3. **Painel `/#admin` abre** → tela de login → senha aceita → KPIs
   aparecem com `1 Visita / 1 Pessoa / 0 Leads / 0%`.

4. **Outro celular abre o site → admin atualiza em ≤5s**
   (esse era o critério de "tempo real").

---

## PARTE F · CHECKLIST FINAL

- [ ] **A.1–A.9** (frontend) coladas no `index.html`
- [ ] **B.1** auth gate com `ADMIN_PWD_HASH` correto
- [ ] **B.2** `Track` carregado em todas as páginas
- [ ] **B.3** `events.js` em `netlify/functions/`
- [ ] **B.5** `netlify.toml` + `package.json` com `@netlify/blobs`
- [ ] **C.1** site Netlify criado (Cowork)
- [ ] **C.2** token de Blobs gerado (Cowork)
- [ ] **C.3** env vars `NETLIFY_BLOBS_*` + `ADMIN_PWD_HASH` configuradas (Cowork)
- [ ] **D** primeiro `netlify deploy --prod` rodou sem erro
- [ ] **E.1** curl POST volta `{"ok":true}`
- [ ] **E.2** curl GET com Bearer volta agregado
- [ ] **E.3** painel `/#admin` mostra dados reais
- [ ] **E.4** segundo dispositivo acende KPIs em <5s

---

## PARTE G · REFERÊNCIAS RÁPIDAS

| Arquivo                         | O que faz                                |
|---------------------------------|------------------------------------------|
| `index.html`                    | Front + Track + render do painel         |
| `netlify/functions/events.js`   | Append-log + agregação                   |
| `netlify.toml`                  | Config do Netlify                        |
| `package.json`                  | Dependência `@netlify/blobs`             |

| Endpoint                                          | Auth          | Quando usa          |
|---------------------------------------------------|---------------|---------------------|
| `POST /.netlify/functions/events`                 | Nenhuma       | Visitante grava ev  |
| `GET  /.netlify/functions/events`                 | Bearer (hash) | Painel admin lê     |
| `DELETE /.netlify/functions/events`               | Bearer (hash) | Limpar dados (raro) |

| Variável de env             | Onde nasce                          |
|-----------------------------|-------------------------------------|
| `NETLIFY_BLOBS_SITE_ID`     | Cowork (C.1)                        |
| `NETLIFY_BLOBS_TOKEN`       | Cowork (C.2)                        |
| `ADMIN_PWD_HASH`            | Você (gera com shasum) — usa na C.3 |

---

**Fim do documento.**

Se algo não estiver coberto aqui, me peça o trecho específico citando a
seção (ex: "expanda B.3 com o chat WhatsApp" ou "preciso da função de
leads também"). Eu adiciono ou crio doc separado.
