// ════════════════════════════════════════════════════════════════
// Netlify Function · /.netlify/functions/events
// Backend de tracking do MedoDeDirigirNuncaMais (Supabase storage).
//
// POST  → grava 1 evento (sem auth, qualquer visitante pode gravar)
// GET   → retorna agregação dos eventos (auth: Bearer ADMIN_PWD_HASH)
// DELETE → limpa todos os eventos (auth: Bearer ADMIN_PWD_HASH)
//
// Storage: tabela public.analytics_events no Supabase.
// Acesso: anon key (RLS permite só INSERT pra anon; GET/DELETE usam
// RPCs SECURITY DEFINER que bypassam RLS, mas as RPCs só são chamadas
// AQUI depois de validar Bearer ADMIN_PWD_HASH).
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isAuthorized(event) {
  const expected = process.env.ADMIN_PWD_HASH;
  if (!expected) return false;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1].trim().toLowerCase() === expected.trim().toLowerCase();
}

// Faz request pro Supabase REST API (sem precisar de SDK pesado)
async function supabase(path, opts = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase env vars não configuradas (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)');
  }
  const url = SUPABASE_URL.replace(/\/+$/, '') + path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey:           SUPABASE_KEY,
      Authorization:    'Bearer ' + SUPABASE_KEY,
      'Content-Type':   'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  // 204 No Content ou 201 Created sem body (INSERT com Prefer: return=minimal)
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// ────────────────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  // ── POST · grava evento ────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return jsonResponse(400, { ok: false, error: 'bad_json' }); }

    const name = String(payload.name || '').trim().slice(0, 80);
    if (!name) return jsonResponse(400, { ok: false, error: 'name_required' });

    const row = {
      name,
      meta:     sanitizeMeta(payload.meta),
      session:  String(payload.session || '').trim().slice(0, 64) || null,
      utm:      sanitizeUTM(payload.utm),
      device:   sanitizeStr(payload.device, 32),
      referrer: sanitizeStr(payload.referrer, 200),
    };

    try {
      await supabase('/rest/v1/analytics_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      return jsonResponse(200, { ok: true });
    } catch (err) {
      // Não falha pro cliente — fire-and-forget. Mas loga.
      console.error('analytics_events INSERT failed:', err.message);
      return jsonResponse(500, { ok: false, error: 'insert_failed', detail: err.message });
    }
  }

  // ── GET · agrega e retorna ─────────────────────────────────
  if (event.httpMethod === 'GET') {
    if (!isAuthorized(event)) {
      return jsonResponse(401, { ok: false, error: 'unauthorized' });
    }
    const range = (event.queryStringParameters?.range || '24h').toString();
    try {
      // Faz as 2 RPCs em paralelo: agregação geral + jornada por sessão
      const [agg, journey] = await Promise.all([
        supabase('/rest/v1/rpc/analytics_get', {
          method: 'POST',
          body: JSON.stringify({ p_range: range }),
        }),
        supabase('/rest/v1/rpc/analytics_sessions_journey', {
          method: 'POST',
          body: JSON.stringify({ p_range: range }),
        }),
      ]);
      // Anexa a jornada ao payload
      return jsonResponse(200, {
        ...(agg || {}),
        sessionsJourney: journey?.sessions || [],
      });
    } catch (err) {
      console.error('analytics RPCs failed:', err.message);
      return jsonResponse(500, { ok: false, error: 'aggregate_failed', detail: err.message });
    }
  }

  // ── DELETE · limpa tudo ────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    if (!isAuthorized(event)) {
      return jsonResponse(401, { ok: false, error: 'unauthorized' });
    }
    try {
      const data = await supabase('/rest/v1/rpc/analytics_clear', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return jsonResponse(200, { ok: true, ...(data || {}) });
    } catch (err) {
      console.error('analytics_clear RPC failed:', err.message);
      return jsonResponse(500, { ok: false, error: 'clear_failed', detail: err.message });
    }
  }

  return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
};

// ────────────────────────────────────────────────────────────────
// SANITIZADORES
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
    if (count >= 8) break;
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
