import type { Handler, HandlerEvent } from "@netlify/functions";

// ─── eduzz-webhook (Netlify Function — proxy) ────────────────────────────────
// A Eduzz não permite configurar headers customizados no webhook customizado.
// O Supabase Edge Functions exige header `apikey` no API Gateway, então o
// request direto dá 401.
//
// Esta function age como PROXY: recebe o POST/GET da Eduzz, adiciona o header
// `apikey` (anon key, hardcoded — é pública mesmo) e o `Authorization Bearer`,
// e repassa pra Edge Function `eduzz-webhook` no Supabase. A resposta volta
// pra Eduzz como veio.
//
// URL final pra colar na Eduzz:
//   https://medodedirigirnuncamais.netlify.app/.netlify/functions/eduzz-webhook?secret=SEU_SECRET
//
// Segurança: o secret real (EDUZZ_WEBHOOK_SECRET) é validado dentro da Edge
// Function do Supabase, não aqui. Esse proxy só repassa.
// =============================================================================

const SUPABASE_URL = "https://qkvinhzwiptfobdvsdtr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdmluaHp3aXB0Zm9iZHZzZHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzE5NzYsImV4cCI6MjA5MDA0Nzk3Nn0.HdleSrgGuymiA3a72aAITy0K5wHaYvcVmESYNzSGZ-M";

const TARGET_BASE = `${SUPABASE_URL}/functions/v1/eduzz-webhook`;

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-eduzz-secret, authorization",
      },
      body: "",
    };
  }

  // Monta a URL alvo preservando a querystring que a Eduzz mandou (com o secret)
  const qs = event.rawQuery ? `?${event.rawQuery}` : "";
  const targetUrl = `${TARGET_BASE}${qs}`;

  // Headers a repassar — incluindo apikey/Authorization que a Eduzz não manda
  const headersOut: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": event.headers["content-type"] || "application/json",
  };

  // Propaga header customizado de secret também (caso o user mande via header)
  if (event.headers["x-eduzz-secret"]) {
    headersOut["x-eduzz-secret"] = event.headers["x-eduzz-secret"];
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: headersOut,
      body:
        event.httpMethod === "POST" || event.httpMethod === "PUT"
          ? event.body || ""
          : undefined,
    });

    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "proxy_error", message: String(err) }),
    };
  }
};
