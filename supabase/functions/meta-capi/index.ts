import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ─────────────────────────────────────────────────────────────────────────────
// meta-capi — relay server-side pra API de Conversões da Meta (CAPI).
//
// Recebe um evento (do eduzz-webhook OU do browser), aplica hash SHA-256 no PII
// e repassa pro endpoint da Graph API da Meta. O token NUNCA aparece no front.
//
// CONFIANÇA (o pulo do gato pra não inflar venda):
//   • Chamada do SERVIDOR (eduzz-webhook) manda o header
//     x-capi-secret = SUPABASE_SERVICE_ROLE_KEY  → "trusted": pode mandar Purchase.
//   • Chamada do BROWSER (site) vem sem esse secret. Só é aceita se:
//       - a Origin for o nosso site, E
//       - o evento NÃO for Purchase (só PageView/ViewContent/InitiateCheckout/Lead…).
//     Assim ninguém consegue forjar uma "venda" batendo nesta função pública.
//
// Deduplicação: quem chama passa o mesmo `event_id` que o Pixel do browser usa
// (pro Purchase, o id da fatura da Eduzz). A Meta junta os dois e conta 1× só.
//
// Segurança: NADA de PII em log. Se faltar o token, não quebra nada (ok:false).
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "998127153121640";
const CAPI_TOKEN = Deno.env.get("META_CAPI_TOKEN") || "";
const GRAPH_VERSION = "v21.0";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://medodedirigirnuncamais.com.br",
  "https://www.medodedirigirnuncamais.com.br",
  "https://medodedirigirnuncamais.netlify.app",
];

// Eventos que o browser (não-confiável) pode disparar. Purchase é SÓ via servidor.
const BROWSER_ALLOWED_EVENTS = new Set([
  "PageView", "ViewContent", "InitiateCheckout", "Lead", "AddToCart", "Search", "Contact", "CompleteRegistration",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-capi-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// SHA-256 em hex — a Meta exige hash dos dados pessoais.
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normaliza ANTES de hashear (senão o match com a Meta quebra).
async function hashField(raw: unknown, kind: "email" | "phone" | "text"): Promise<string | undefined> {
  if (raw == null) return undefined;
  let v = String(raw).trim().toLowerCase();
  if (!v) return undefined;
  if (kind === "phone") {
    v = v.replace(/\D/g, "");                                   // só dígitos
    if (!v) return undefined;
    if (v.length <= 11 && !v.startsWith("55")) v = "55" + v;    // DDI Brasil
  }
  if (kind === "email" && !v.includes("@")) return undefined;
  return await sha256(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") return json({ ok: true, service: "meta-capi", ready: !!CAPI_TOKEN });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // ── Confiança ───────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-capi-secret") || "";
  const trusted = SERVICE_KEY.length > 0 && secret === SERVICE_KEY;
  const origin = req.headers.get("origin") || "";
  const eventName = String(body.event_name || "").trim();

  if (!eventName) return json({ ok: false, reason: "missing_event_name" }, 400);
  if (!trusted) {
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, reason: "forbidden_origin" }, 403);
    if (!BROWSER_ALLOWED_EVENTS.has(eventName)) return json({ ok: false, reason: "event_not_allowed_from_browser" }, 403);
  }

  // Sem token configurado ainda → não quebra nada (o webhook segue normal).
  if (!CAPI_TOKEN) return json({ ok: false, reason: "missing_capi_token" }, 200);

  // ── user_data: PII vai HASHEADO; fbp/fbc/ip/ua vão CRUS ──────────────────────
  const ud: Record<string, unknown> = {};
  const em = await hashField(body.email, "email");          if (em) ud.em = [em];
  const ph = await hashField(body.phone, "phone");          if (ph) ud.ph = [ph];
  const fn = await hashField(body.first_name, "text");      if (fn) ud.fn = [fn];
  const ln = await hashField(body.last_name, "text");       if (ln) ud.ln = [ln];
  const ext = await hashField(body.external_id, "text");    if (ext) ud.external_id = [ext];
  if (body.fbp) ud.fbp = String(body.fbp);
  if (body.fbc) ud.fbc = String(body.fbc);
  if (trusted) {
    if (body.client_ip_address) ud.client_ip_address = String(body.client_ip_address);
    if (body.client_user_agent) ud.client_user_agent = String(body.client_user_agent);
  } else {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const ua = req.headers.get("user-agent") || "";
    if (ip) ud.client_ip_address = ip;
    if (ua) ud.client_user_agent = ua;
  }

  // ── custom_data ──────────────────────────────────────────────────────────────
  const custom: Record<string, unknown> = {};
  if (body.value != null && !Number.isNaN(Number(body.value))) custom.value = Number(body.value);
  if (body.currency) custom.currency = String(body.currency);
  if (body.content_name) custom.content_name = String(body.content_name);
  if (body.content_ids) custom.content_ids = body.content_ids;
  if (body.contents) custom.contents = body.contents;

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Number(body.event_time) || Math.floor(Date.now() / 1000),
    action_source: body.action_source || "website",
    user_data: ud,
  };
  if (body.event_id) event.event_id = String(body.event_id);
  if (body.event_source_url) event.event_source_url = String(body.event_source_url);
  if (Object.keys(custom).length) event.custom_data = custom;

  const payload: Record<string, unknown> = { data: [event] };
  if (body.test_event_code) payload.test_event_code = String(body.test_event_code);

  // ── Envia pra Graph API (timeout pra nunca travar quem chamou) ───────────────
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const out = await r.json().catch(() => ({}));
    // Log SEM PII — só metadados pra debug.
    console.log(`[meta-capi] ${eventName} id=${event.event_id ?? "-"} http=${r.status} received=${out?.events_received ?? "?"} trace=${out?.fbtrace_id ?? "-"}`);
    return json({ ok: r.ok, status: r.status, events_received: out?.events_received, fbtrace_id: out?.fbtrace_id, error: out?.error });
  } catch (e) {
    console.warn(`[meta-capi] envio falhou (${eventName}):`, e instanceof Error ? e.message : String(e));
    return json({ ok: false, reason: "send_failed" }, 200);
  } finally {
    clearTimeout(timer);
  }
});
