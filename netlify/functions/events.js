// ════════════════════════════════════════════════════════════════
// Netlify Function · /.netlify/functions/events
// Backend de tracking de comportamento do site MedoDeDirigirNuncaMais.
//
// POST  → grava 1 evento (sem auth, qualquer visitante pode gravar)
// GET   → retorna agregação dos eventos (auth: Bearer ADMIN_PWD_HASH)
// DELETE → limpa todos os eventos (auth: Bearer ADMIN_PWD_HASH)
//
// Storage: Netlify Blobs (append-log de até 5000 eventos).
// On-read aggregation: o GET calcula a agregação na hora (sem cron job).
// ════════════════════════════════════════════════════════════════

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'mddnm_events_v1';
const LOG_KEY    = 'log';
const MAX_LOG    = 5000;

// CORS — deixa o sales.html (mesmo domínio) e admin-dash (mesmo domínio) chamarem
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Verifica Bearer token contra ADMIN_PWD_HASH (env var no Netlify)
function isAuthorized(event) {
  const expected = process.env.ADMIN_PWD_HASH;
  if (!expected) return false;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1].trim().toLowerCase() === expected.trim().toLowerCase();
}

// Abre o store. Em produção (Netlify) usa env vars; em dev local usa nome puro.
function openStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  return (siteID && token)
    ? getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' })
    : getStore(STORE_NAME);
}

// ────────────────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  let store;
  try {
    store = openStore();
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: 'storage_unavailable', detail: err.message })
    };
  }

  // ── POST · grava evento ────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'bad_json' }) };
    }

    const name = String(payload.name || '').trim().slice(0, 80);
    if (!name) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'name_required' }) };
    }

    const record = {
      ts:       Date.now(),
      name,
      meta:     sanitizeMeta(payload.meta),
      session:  String(payload.session || '').trim().slice(0, 64) || null,
      utm:      sanitizeUTM(payload.utm),
      // dados do visitante (pra agregação) — NUNCA inclui IP nem dados pessoais
      device:   sanitizeStr(payload.device, 32),
      referrer: sanitizeStr(payload.referrer, 200),
    };

    const log = (await store.get(LOG_KEY, { type: 'json' })) || { items: [] };
    log.items.unshift(record);
    if (log.items.length > MAX_LOG) log.items.length = MAX_LOG;
    await store.setJSON(LOG_KEY, log);

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  }

  // ── GET · agrega e retorna ─────────────────────────────────
  if (event.httpMethod === 'GET') {
    if (!isAuthorized(event)) {
      return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    }
    const log = (await store.get(LOG_KEY, { type: 'json' })) || { items: [] };
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...aggregate(log.items) })
    };
  }

  // ── DELETE · limpa tudo ────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    if (!isAuthorized(event)) {
      return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    }
    await store.setJSON(LOG_KEY, { items: [] });
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, cleared: true })
    };
  }

  return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
};

// ────────────────────────────────────────────────────────────────
// SANITIZADORES (proteção contra payloads abusivos)
// ────────────────────────────────────────────────────────────────
function sanitizeStr(v, maxLen = 80) {
  if (v == null) return null;
  return String(v).trim().slice(0, maxLen) || null;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (count >= 8) break;                 // máx 8 campos por evento
    const key = String(k).slice(0, 40);
    const val = (v == null) ? null
              : typeof v === 'number' ? v
              : typeof v === 'boolean' ? v
              : String(v).slice(0, 120);
    out[key] = val;
    count++;
  }
  return out;
}

function sanitizeUTM(utm) {
  if (!utm || typeof utm !== 'object') return null;
  const fields = ['source', 'medium', 'campaign', 'content', 'term'];
  const out = {};
  for (const f of fields) {
    if (utm[f]) out[f] = String(utm[f]).slice(0, 80);
  }
  return Object.keys(out).length ? out : null;
}

// ────────────────────────────────────────────────────────────────
// AGREGAÇÃO ON-READ
// Calcula contadores que o admin-dash precisa direto na resposta GET.
// ────────────────────────────────────────────────────────────────
function aggregate(items) {
  const events    = {};                        // count por nome
  const sessions  = new Set();
  const utmSources= {};                        // count por "source/medium"
  const ctaClicks = {};                        // count por nome do CTA
  const moduleHits= {};                        // count por módulo
  const diagAns   = {};                        // pergunta → opção → count
  const webVitals = { LCP: [], INP: [], CLS: [] };

  // Janelas temporais (timestamps em ms)
  const NOW       = Date.now();
  const D1        = 24 * 60 * 60 * 1000;
  const D7        = 7  * D1;
  const D30       = 30 * D1;

  const buckets = {
    '24h': { since: NOW - D1,  events: {}, sessions: new Set() },
    '7d':  { since: NOW - D7,  events: {}, sessions: new Set() },
    '30d': { since: NOW - D30, events: {}, sessions: new Set() },
    'all': { since: 0,         events: {}, sessions: new Set() },
  };
  // pra calcular delta% (período anterior)
  const prevBuckets = {
    '24h': { from: NOW - 2*D1, to: NOW - D1,  events: {}, sessions: new Set() },
    '7d':  { from: NOW - 2*D7, to: NOW - D7,  events: {}, sessions: new Set() },
    '30d': { from: NOW - 2*D30,to: NOW - D30, events: {}, sessions: new Set() },
  };

  for (const ev of items) {
    if (!ev || !ev.name) continue;
    events[ev.name] = (events[ev.name] || 0) + 1;
    if (ev.session) sessions.add(ev.session);

    // UTMs (source / medium combinados)
    if (ev.utm && (ev.utm.source || ev.utm.medium)) {
      const key = `${ev.utm.source || '(direct)'} / ${ev.utm.medium || '—'}`;
      utmSources[key] = (utmSources[key] || 0) + 1;
    }

    // CTAs — eventos com nome iniciando em "clicou_cta_"
    if (ev.name.startsWith('clicou_cta_')) {
      const ctaLabel = ev.meta?.label || ev.name.replace('clicou_cta_', '');
      ctaClicks[ctaLabel] = (ctaClicks[ctaLabel] || 0) + 1;
    }

    // Módulos clicados
    if (ev.name === 'modulo_clicado' && ev.meta?.modulo) {
      moduleHits[ev.meta.modulo] = (moduleHits[ev.meta.modulo] || 0) + 1;
    }

    // Diagnóstico
    if (ev.name === 'diagnostico_resposta' && ev.meta?.pergunta && ev.meta?.opcao) {
      const q = ev.meta.pergunta;
      const o = ev.meta.opcao;
      diagAns[q] = diagAns[q] || {};
      diagAns[q][o] = (diagAns[q][o] || 0) + 1;
    }

    // Web Vitals
    if (ev.name === 'web_vital' && ev.meta?.metric && typeof ev.meta?.value === 'number') {
      const m = ev.meta.metric.toUpperCase();
      if (webVitals[m]) webVitals[m].push(ev.meta.value);
    }

    // Buckets temporais
    for (const k of Object.keys(buckets)) {
      const b = buckets[k];
      if (ev.ts >= b.since) {
        b.events[ev.name] = (b.events[ev.name] || 0) + 1;
        if (ev.session) b.sessions.add(ev.session);
      }
    }
    for (const k of Object.keys(prevBuckets)) {
      const b = prevBuckets[k];
      if (ev.ts >= b.from && ev.ts < b.to) {
        b.events[ev.name] = (b.events[ev.name] || 0) + 1;
        if (ev.session) b.sessions.add(ev.session);
      }
    }
  }

  // Recent (últimos 50 eventos com timestamp)
  const recent = items.slice(0, 50).map(it => ({
    name:    it.name,
    meta:    it.meta,
    ts:      it.ts,
    session: it.session,
  }));

  // Web vitals: calcula p75 (padrão da indústria)
  const wv = {};
  for (const m of ['LCP', 'INP', 'CLS']) {
    const arr = webVitals[m].slice().sort((a, b) => a - b);
    if (!arr.length) { wv[m] = null; continue; }
    const p75 = arr[Math.floor(arr.length * 0.75)];
    wv[m] = { p75, count: arr.length };
  }

  // Buckets serializados
  const bucketsOut = {};
  for (const k of Object.keys(buckets)) {
    bucketsOut[k] = {
      events:   buckets[k].events,
      sessions: buckets[k].sessions.size,
    };
  }
  const prevOut = {};
  for (const k of Object.keys(prevBuckets)) {
    prevOut[k] = {
      events:   prevBuckets[k].events,
      sessions: prevBuckets[k].sessions.size,
    };
  }

  return {
    total:        items.length,
    events,
    sessions:     sessions.size,
    utmSources,
    ctaClicks,
    moduleHits,
    diagAns,
    webVitals:    wv,
    recent,
    buckets:      bucketsOut,
    prevBuckets:  prevOut,
    aggregatedAt: NOW,
  };
}
