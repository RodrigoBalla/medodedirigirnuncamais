import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─── admin-first-access ─────────────────────────────────────────────────────
// Endpoint pra admin:
//   action="get_link"     → retorna URL única de primeiro acesso do aluno
//   action="resend_email" → dispara email transacional (Brevo) com a URL
//
// Reusa token ativo (não usado + não expirado) ou cria um novo via RPC
// public.admin_first_access_for_user(p_user_id).
//
// verify_jwt=true: o JWT do admin é encaminhado pro Postgres, e a RPC checa
// _is_admin() antes de tudo.
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_URL") || "https://medodedirigirnuncamais.netlify.app";
const BREVO_FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "naoresponda@medodedirigirnuncamais.com.br";
const BREVO_FROM_NAME = Deno.env.get("BREVO_FROM_NAME") || "Carla · Medo de Dirigir Nunca Mais";
const BREVO_FIRST_ACCESS_TEMPLATE_ID = Deno.env.get("BREVO_FIRST_ACCESS_TEMPLATE_ID");

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function firstName(f: string): string { return (f || "").trim().split(/\s+/)[0] || "aluna"; }

// Gera uma senha forte porém legível (sem caracteres ambíguos 0/O/1/l/I).
// 10 chars via crypto.getRandomValues — suficiente pra onboarding.
function genPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

async function sendBrevoFirstAccessEmail(args: { toEmail: string; toName: string; courseTitle: string; firstAccessUrl: string }): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return { ok: false, reason: "missing_brevo_key" };
  const params = { NOME: firstName(args.toName), CURSO: args.courseTitle || "Medo de Dirigir Nunca Mais", LINK_PRIMEIRO_ACESSO: args.firstAccessUrl };
  const payload: any = {
    sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
    to: [{ email: args.toEmail, name: args.toName || firstName(args.toName) }],
    params,
  };
  if (BREVO_FIRST_ACCESS_TEMPLATE_ID) {
    payload.templateId = Number(BREVO_FIRST_ACCESS_TEMPLATE_ID);
    payload.subject = `🎉 Seu acesso ao curso ${params.CURSO} (reenviado)`;
  } else {
    payload.subject = `🎉 Seu acesso ao curso ${params.CURSO} (reenviado)`;
    payload.htmlContent = `<html><body style="font-family:Arial,sans-serif;background:#0B1A38;color:#fff;padding:24px"><div style="max-width:560px;margin:0 auto;background:#16264D;border-radius:16px;padding:32px"><h1 style="color:#FFD60A;margin:0 0 16px">Olá, ${params.NOME}!</h1><p>Aqui está o seu link de primeiro acesso ao curso <strong>${params.CURSO}</strong>:</p><p style="text-align:center;margin:28px 0"><a href="${args.firstAccessUrl}" style="display:inline-block;background:#FFD60A;color:#0B1A38;padding:16px 28px;border-radius:12px;text-decoration:none;font-weight:900">Criar senha e acessar</a></p><p style="font-size:12px;opacity:.7">O link expira em 7 dias. Se você já criou sua senha, use o /login normalmente.</p></div></body></html>`;
  }
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "accept": "application/json", "api-key": apiKey, "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) { const t = await r.text(); return { ok: false, reason: `brevo_${r.status}: ${t.slice(0, 200)}` }; }
    const j = await r.json();
    return { ok: true, messageId: j?.messageId };
  } catch (e) {
    return { ok: false, reason: `fetch_error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonResp({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: "invalid_json" }, 400); }

  const action = String(body?.action || "").toLowerCase();
  const userId = String(body?.user_id || "").trim();
  if (!userId) return jsonResp({ error: "missing_user_id" }, 400);

  // Forward JWT do admin (verify_jwt=true garante que veio um)
  const authHeader = req.headers.get("Authorization") || "";

  // Checagem de admin via JWT — RPC interna checa _is_admin()
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } },
  );
  const { data: tokenData, error: rpcErr } = await userClient.rpc("admin_first_access_for_user", { p_user_id: userId });
  if (rpcErr) {
    console.error("[admin-first-access] rpc error:", rpcErr);
    const msg = String(rpcErr.message || "").toLowerCase();
    if (msg.includes("forbidden")) return jsonResp({ error: "forbidden" }, 403);
    if (msg.includes("user_not_found")) return jsonResp({ error: "user_not_found" }, 404);
    return jsonResp({ error: "rpc_failed", detail: rpcErr.message }, 500);
  }
  const row = Array.isArray(tokenData) ? tokenData[0] : tokenData;
  if (!row?.token) return jsonResp({ error: "no_token" }, 500);

  const link = `${APP_URL}/primeiro-acesso?token=${row.token}`;

  if (action === "get_link") {
    return jsonResp({ ok: true, link, email: row.email, expires_in_days: 7 });
  }

  if (action === "resend_email") {
    const r = await sendBrevoFirstAccessEmail({
      toEmail: row.email,
      toName: row.display_name || "Aluna",
      courseTitle: row.course_title || "Medo de Dirigir Nunca Mais",
      firstAccessUrl: link,
    });

    // log em email_sends (best-effort, com service role)
    try {
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      await svc.from("email_sends").insert({
        user_id: userId,
        email: row.email,
        kind: "first_access_resend",
        product_id: null,
        brevo_message_id: r.messageId || null,
      });
    } catch (e) { console.warn("[admin-first-access] email_sends insert failed:", e); }

    if (!r.ok) return jsonResp({ ok: false, reason: r.reason }, 500);
    return jsonResp({ ok: true, message_id: r.messageId, link });
  }

  // Define (redefine) a senha do aluno e devolve pro admin repassar.
  // A senha real NUNCA pode ser lida (fica em hash) — então "ver a senha"
  // = gerar uma nova. Atenção: isso SUBSTITUI qualquer senha anterior.
  if (action === "set_password") {
    const provided = typeof body?.password === "string" ? body.password.trim() : "";
    const password = provided.length >= 6 ? provided : genPassword();
    try {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { error: upErr } = await svc.auth.admin.updateUserById(userId, { password });
      if (upErr) {
        console.error("[admin-first-access] set_password failed:", upErr);
        return jsonResp({ error: "set_password_failed", detail: upErr.message }, 500);
      }
    } catch (e) {
      console.error("[admin-first-access] set_password exception:", e);
      return jsonResp({ error: "set_password_failed", detail: String(e) }, 500);
    }
    return jsonResp({
      ok: true,
      password,
      email: row.email,
      display_name: row.display_name || "",
      login_url: `${APP_URL}/login`,
    });
  }

  return jsonResp({ error: "unknown_action" }, 400);
});
