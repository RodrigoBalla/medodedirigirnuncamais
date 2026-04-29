import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// =============================================================================
// EDUZZ WEBHOOK
// Recebe Postback / Notification da Eduzz e popula/remove a tabela
// public.enrolled_emails que controla quem pode se cadastrar no app.
//
// Configuração no painel da Eduzz:
//   URL do Postback:
//     https://qkvinhzwiptfobdvsdtr.supabase.co/functions/v1/eduzz-webhook?secret=SEU_SECRET
//
// Secret (variável EDUZZ_WEBHOOK_SECRET) deve ser configurada em:
//   https://supabase.com/dashboard/project/qkvinhzwiptfobdvsdtr/functions
//   → Edge Functions → eduzz-webhook → Add new secret
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-eduzz-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Status da Eduzz que liberam acesso (legacy Postback 2.0 + MyEduzz Notifications).
const PAID_HINTS = ["paid", "approved", "invoice_paid", "active"];
// Status que devem revogar acesso.
const CANCEL_HINTS = [
  "refunded", "chargeback", "canceled", "cancelled",
  "invoice_refunded", "invoice_canceled", "contract_canceled",
];
// Equivalentes numéricos do Postback 2.0 antigo: 2 = aprovado, 4/5 = estornado/charge.
const PAID_NUMERIC = new Set(["2"]);
const CANCEL_NUMERIC = new Set(["4", "5"]);

function pick(obj: any, ...paths: string[]): string {
  for (const p of paths) {
    const segments = p.split(".");
    let cur: any = obj;
    for (const s of segments) {
      if (cur == null) break;
      cur = cur[s];
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return "";
}

function classify(status: string): "paid" | "cancel" | "ignore" {
  const s = status.toLowerCase();
  if (PAID_HINTS.some((h) => s.includes(h))) return "paid";
  if (CANCEL_HINTS.some((h) => s.includes(h))) return "cancel";
  if (PAID_NUMERIC.has(s)) return "paid";
  if (CANCEL_NUMERIC.has(s)) return "cancel";
  return "ignore";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 1. Autenticação por shared secret (query string OU header).
  const expected = Deno.env.get("EDUZZ_WEBHOOK_SECRET") || "";
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("secret") ||
    req.headers.get("x-eduzz-secret") ||
    "";
  if (!expected || provided !== expected) {
    console.error("[eduzz-webhook] secret inválido");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 2. Parse defensivo (Eduzz envia JSON ou x-www-form-urlencoded conforme produto/configuração).
  let payload: Record<string, any> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      payload = Object.fromEntries(new URLSearchParams(await req.text()));
    } else if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) payload[k] = String(v);
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = Object.fromEntries(new URLSearchParams(text));
      }
    }
  } catch (e) {
    console.error("[eduzz-webhook] parse error:", e);
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.log("[eduzz-webhook] payload:", JSON.stringify(payload).slice(0, 800));

  // 3. Extrai email + status testando vários caminhos (Postback 2.0 + MyEduzz Notifications).
  const email = pick(
    payload,
    "cust_email",
    "customer.email",
    "data.customer.email",
    "buyer.email",
    "data.buyer.email",
    "email",
  ).toLowerCase();

  const status = pick(
    payload,
    "trans_status",
    "event",
    "status",
    "data.status",
    "data.invoice.status",
    "invoice.status",
  );

  const name = pick(
    payload,
    "cust_name",
    "customer.name",
    "data.customer.name",
    "buyer.name",
  );

  const productName = pick(
    payload,
    "prod_name",
    "product.name",
    "data.content.0.name",
    "items.0.name",
  );

  if (!email || !email.includes("@")) {
    console.warn("[eduzz-webhook] sem email no payload, ignorando");
    return new Response(
      JSON.stringify({ ok: true, action: "ignored", reason: "no_email" }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const action = classify(status);

  if (action === "ignore") {
    console.log(`[eduzz-webhook] status "${status}" não acionável, ignorando`);
    return new Response(
      JSON.stringify({ ok: true, action: "ignored", reason: "non_actionable_status", status }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // 4. Conecta ao Supabase com service-role pra contornar RLS (só admin escreve em enrolled_emails).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const noteParts = [
    `Eduzz: ${status}`,
    name ? `nome=${name}` : "",
    productName ? `produto=${productName}` : "",
    `recv=${new Date().toISOString().slice(0, 19)}Z`,
  ].filter(Boolean);
  const note = noteParts.join(" | ");

  if (action === "paid") {
    const { error } = await supabase
      .from("enrolled_emails")
      .upsert({ email, notes: note }, { onConflict: "email" });
    if (error) {
      console.error("[eduzz-webhook] insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    console.log(`[eduzz-webhook] ✅ ADD ${email} (${status})`);
    return new Response(
      JSON.stringify({ ok: true, action: "added", email, status }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  if (action === "cancel") {
    const { error } = await supabase
      .from("enrolled_emails")
      .delete()
      .eq("email", email);
    if (error) {
      console.error("[eduzz-webhook] delete error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    console.log(`[eduzz-webhook] ⛔ REMOVE ${email} (${status})`);
    return new Response(
      JSON.stringify({ ok: true, action: "removed", email, status }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // unreachable
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
});
