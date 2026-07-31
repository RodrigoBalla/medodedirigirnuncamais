import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// eduzz-webhook v28 — sobre v27: liberacao escalonada (drip). Em vez de liberar
//   TODOS os grupos na hora, chama a RPC grant_or_schedule_groups: o principal
//   ("Acesso Completo") libera na hora e os upsells comprados JUNTO ficam
//   agendados pra +7 dias (release_due_group_grants via pg_cron libera depois).
//   Upsell sozinho / ja possuido libera na hora. Fallback: se a RPC falhar,
//   libera tudo na hora (nunca deixa aluna paga sem acesso).
// eduzz-webhook v27 — sobre v26: valor da compra vem de data.price.* / data.payment.*
//   (MyEduzz Notifications nao tem data.value). Loga rawprice/rawpay pra cravar
//   a estrutura (reais vs centavos). Fatura (event_id) = data.id, ja confirmado.
// eduzz-webhook v26 — sobre v25: extracao de fatura/valor robusta pro formato
//   MyEduzz Notifications (data.id) + registra capi_id/capi_val/dkeys nos notes.
// eduzz-webhook v25 — sobre v24: dispara Purchase na Meta CAPI (server-side, via
//   funcao meta-capi) quando o pagamento aprova. event_id = fatura (idempotente).
//   (v24) Link de primeiro acesso usa CAMINHO (/primeiro-acesso/TOKEN).
//   (v22) PROCESSA TODOS OS ITENS DA COMPRA (combo + order bumps).
//   (v17) Rejeita compras que nao mapeiam pra grupo MDNM; salva telefone + nome.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eduzz-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const PAID_HINTS = ["paid", "approved", "invoice_paid", "active"];
const CANCEL_HINTS = ["refunded", "chargeback", "canceled", "cancelled", "invoice_refunded", "invoice_canceled", "contract_canceled"];
const PAID_NUMERIC = new Set(["2"]);
const CANCEL_NUMERIC = new Set(["4", "5"]);
const APP_URL = Deno.env.get("APP_URL") || "https://medodedirigirnuncamais.netlify.app";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1122913764235310";
const WHATSAPP_TEMPLATE_NAME = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "matricula_confirmada";
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "pt_BR";
const WHATSAPP_GRAPH_VERSION = "v21.0";
const BREVO_FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "naoresponda@medodedirigirnuncamais.com.br";
const BREVO_FROM_NAME = Deno.env.get("BREVO_FROM_NAME") || "Carla · Medo de Dirigir Nunca Mais";

function pick(obj: any, ...paths: string[]): string { for (const p of paths) { const segs = p.split("."); let c: any = obj; for (const s of segs) { if (c == null) break; c = c[s]; } if (typeof c === "string" && c.trim()) return c.trim(); if (typeof c === "number") return String(c); } return ""; }
function classify(s: string): "paid" | "cancel" | "ignore" { const l = s.toLowerCase(); if (PAID_HINTS.some(h => l.includes(h))) return "paid"; if (CANCEL_HINTS.some(h => l.includes(h))) return "cancel"; if (PAID_NUMERIC.has(l)) return "paid"; if (CANCEL_NUMERIC.has(l)) return "cancel"; return "ignore"; }
function uniq<T>(a: T[]): T[] { return [...new Set(a)]; }
function normalizePhoneBR(raw: string): string | null { if (!raw) return null; const d = raw.replace(/\D/g, ""); if (!d) return null; if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d; if (d.length === 10 || d.length === 11) return "55" + d; if (d.length >= 10) return d; return null; }
function generateStrongPassword(): string { const b = new Uint8Array(48); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, "").slice(0, 64); }
function firstName(f: string): string { return (f || "").trim().split(/\s+/)[0] || "aluna"; }
function esc(s: string): string { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function parseAmount(raw: string): number | null { if (!raw) return null; let s = raw.trim().replace(/[^0-9.,-]/g, ""); if (!s) return null; if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", "."); else if (s.includes(",")) s = s.replace(",", "."); const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : null; }

async function sendCapiPurchase(args: { email: string; phone: string | null; name: string; eventId: string; value: number | null; productName: string }) {
  try {
    const base = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !key) return;
    const parts = (args.name || "").trim().split(/\s+/).filter(Boolean);
    const body: Record<string, unknown> = { event_name: "Purchase", event_id: args.eventId, action_source: "website", event_source_url: "https://medodedirigirnuncamais.com.br/obrigado", email: args.email, currency: "BRL", content_name: args.productName };
    if (args.phone) body.phone = args.phone;
    if (parts[0]) body.first_name = parts[0];
    if (parts.length > 1) body.last_name = parts[parts.length - 1];
    if (args.value != null) body.value = args.value;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${base}/functions/v1/meta-capi`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "x-capi-secret": key }, body: JSON.stringify(body), signal: ctrl.signal });
    clearTimeout(timer);
    const out = await r.json().catch(() => ({}));
    console.log(`[webhook capi] Purchase id=${args.eventId} ok=${out?.ok} received=${out?.events_received ?? "?"} reason=${out?.reason ?? "-"}`);
  } catch (e) { console.warn("[webhook capi] Purchase falhou (nao-critico):", e instanceof Error ? e.message : String(e)); }
}

function getInvoiceItems(payload: any): Array<{ id: string; name: string }> {
  const arrays = [
    payload?.data?.invoice?.items,
    payload?.invoice?.items,
    payload?.data?.items,
    payload?.items,
    payload?.data?.content,
    payload?.content,
  ];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      const mapped = arr.map((it: any) => ({
        id: String(it?.id ?? it?.product_id ?? it?.product?.id ?? it?.cod ?? it?.product_cod ?? "").trim(),
        name: String(it?.name ?? it?.product_name ?? it?.product?.name ?? it?.title ?? "").trim(),
      })).filter((x: { id: string; name: string }) => x.id || x.name);
      if (mapped.length) return mapped;
    }
  }
  return [];
}

function firstAccessEmailHtml(a: { nome: string; curso: string; link: string }): string {
  const nome = esc(a.nome || "Aluna");
  const curso = esc(a.curso || "Medo de Dirigir Nunca Mais");
  const link = a.link;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR"><head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>@media only screen and (max-width:600px){.container{width:100%!important;max-width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}}</style>
</head>
<body style="margin:0;padding:0;background-color:#0B1A38;font-family:Lexend,Arial,Helvetica,sans-serif;color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B1A38"><tr><td align="center" style="padding:32px 16px">
 <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px"><tr><td height="6" style="background-color:#FFD60A;line-height:6px;font-size:6px;border-radius:8px 8px 0 0">&nbsp;</td></tr></table>
 <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#16264D;border-radius:0 0 16px 16px">
  <tr><td class="px" style="padding:32px 40px 8px"><p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#FFD60A">🎉 Matrícula confirmada</p></td></tr>
  <tr><td class="px" style="padding:0 40px 8px"><h1 style="margin:0;font-size:32px;line-height:1.1;font-weight:900;color:#ffffff">Parabéns, <span style="color:#FFD60A">${nome}!</span></h1></td></tr>
  <tr><td class="px" style="padding:12px 40px 20px"><p style="margin:0;font-size:16px;line-height:1.6;color:#C5C8D1">Sua matrícula no curso <strong style="color:#fff">${curso}</strong> foi confirmada. Falta só <strong style="color:#fff">criar sua senha</strong> pra entrar na área de membros.</p></td></tr>
  <tr><td class="px" align="center" style="padding:8px 40px 12px">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:54px;v-text-anchor:middle;width:300px;" arcsize="26%" stroke="f" fillcolor="#FFD60A"><w:anchorlock/><center style="color:#0B1A38;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Criar senha e entrar &rarr;</center></v:roundrect><![endif]-->
    <!--[if !mso]><!-- --><a href="${link}" target="_blank" style="display:inline-block;background-color:#FFD60A;color:#0B1A38;padding:18px 34px;border-radius:14px;font-family:Lexend,Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Criar senha e entrar &rarr;</a><!--<![endif]-->
    <p style="margin:14px 0 0;font-size:11px;color:#8B92A8">🔒 Link único · válido por 7 dias</p>
  </td></tr>
  <tr><td class="px" style="padding:8px 40px 24px"><p style="margin:0 0 6px;font-size:12px;color:#8B92A8">Se o botão não funcionar, copie e cole este link no navegador:</p><p style="margin:0;word-break:break-all"><a href="${link}" target="_blank" style="font-size:12px;color:#FFD60A;text-decoration:underline;word-break:break-all">${link}</a></p></td></tr>
  <tr><td class="px" style="padding:0 40px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B1A38;border-radius:10px"><tr><td style="padding:14px 18px"><p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#8B92A8">💬 Suporte</p><p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#C5C8D1">Travou? Fala no WhatsApp: <a href="https://wa.me/5521974703113" target="_blank" style="color:#FFD60A;font-weight:700;text-decoration:none">+55 21 97470-3113</a></p><p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:#8B92A8">📵 Este é um e-mail automático — <strong style="color:#C5C8D1">não responda este e-mail</strong>. Pra falar com a gente, use o WhatsApp acima.</p></td></tr></table></td></tr>
 </table>
 <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin-top:20px"><tr><td align="center" style="padding:0 40px"><p style="margin:0;font-size:11px;color:#8B92A8">© 2026 Medo de Dirigir Nunca Mais · CFC Jó · CNPJ 16.826.768/0001-59</p></td></tr></table>
</td></tr></table></body></html>`;
}

async function sendWhatsAppTemplate(to: string, name: string, productName: string) { const token = Deno.env.get("META_ACCESS_TOKEN"); if (!token) return { ok: false, reason: "missing_meta_token" }; if (!to) return { ok: false, reason: "missing_phone" }; const endpoint = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`; const body = { messaging_product: "whatsapp", to, type: "template", template: { name: WHATSAPP_TEMPLATE_NAME, language: { code: WHATSAPP_TEMPLATE_LANG }, components: [{ type: "body", parameters: [{ type: "text", text: (name || "aluna").slice(0, 60) }, { type: "text", text: (productName || "Medo de Dirigir Nunca Mais").slice(0, 120) }] }] } }; try { const r = await fetch(endpoint, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const t = await r.text(); let p: any = t; try { p = JSON.parse(t); } catch {} return { ok: r.ok, status: r.status, body: p }; } catch (e) { return { ok: false, reason: `fetch_error: ${e instanceof Error ? e.message : String(e)}` }; } }

async function sendBrevoFirstAccessEmail(args: { toEmail: string; toName: string; courseTitle: string; firstAccessUrl: string }): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return { ok: false, reason: "missing_brevo_key" };
  const curso = args.courseTitle || "Medo de Dirigir Nunca Mais";
  const payload: any = {
    sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
    to: [{ email: args.toEmail, name: args.toName || firstName(args.toName) }],
    subject: `🎉 Sua matrícula em ${curso} foi confirmada`,
    htmlContent: firstAccessEmailHtml({ nome: firstName(args.toName), curso, link: args.firstAccessUrl }),
  };
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
  if (req.method === "GET" || req.method === "HEAD") return new Response(JSON.stringify({ ok: true, service: "eduzz-webhook", version: 28, ready: true }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  const expected = Deno.env.get("EDUZZ_WEBHOOK_SECRET") || "";
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") || req.headers.get("x-eduzz-secret") || "";
  if (expected && provided !== expected) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

  let payload: Record<string, any> = {};
  const ct = req.headers.get("content-type") || "";
  try { if (ct.includes("application/json")) payload = await req.json(); else if (ct.includes("application/x-www-form-urlencoded")) payload = Object.fromEntries(new URLSearchParams(await req.text())); else if (ct.includes("multipart/form-data")) { const fd = await req.formData(); for (const [k, v] of fd.entries()) payload[k] = String(v); } else { const t = await req.text(); try { payload = JSON.parse(t); } catch { payload = Object.fromEntries(new URLSearchParams(t)); } } } catch (e) { return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }
  console.log("[webhook v28] payload:", JSON.stringify(payload).slice(0, 2000));
  const email = pick(payload, "cust_email", "customer.email", "data.customer.email", "data.buyer.email", "buyer.email", "email").toLowerCase();
  const status = pick(payload, "trans_status", "event", "status", "data.status", "data.invoice.status", "invoice.status");
  const name = pick(payload, "cust_name", "customer.name", "data.customer.name", "data.buyer.name", "buyer.name");
  const phoneRaw = pick(payload, "cust_cel", "cust_phone", "customer.cel", "customer.cellphone", "customer.phone", "data.customer.cel", "data.customer.cellphone", "data.customer.phone", "data.buyer.cel", "data.buyer.cellphone", "data.buyer.phone", "buyer.cel", "buyer.cellphone", "buyer.phone", "phone", "cel", "cellphone");
  const productName = pick(payload, "prod_name", "product.name", "data.content.0.name", "items.0.name", "data.invoice.items.0.name", "data.invoice.product_name", "data.invoice.product.name", "data.items.0.name", "data.product.name", "invoice.items.0.name");
  const productId = pick(payload, "product_cod", "prod_id", "product.id", "product_id", "data.content.0.id", "items.0.id", "data.invoice.items.0.id", "data.invoice.items.0.product_id", "data.invoice.product_id", "data.invoice.product.id", "data.items.0.id", "data.product.id", "invoice.items.0.id");
  const invoiceId = pick(payload, "data.id", "data.invoice.id", "trans_cod", "invoice.id", "data.transaction_id", "data.transaction.id", "data.invoice.invoice_id", "data.sale.id", "data.sale_id", "sale_id", "trans_id", "id");
  const amountRaw = pick(payload, "data.price.value", "data.price.amount", "data.price.total", "data.price.paid_value", "data.price.paidValue", "data.payment.value", "data.payment.amount", "data.payment.total", "data.payment.paid_value", "data.price", "data.paid_value", "data.value", "data.amount", "data.total", "data.paid_amount", "data.invoice.paid_amount", "data.invoice.value", "data.invoice.total", "trans_paid", "trans_value", "value", "amount");

  if (!email || !email.includes("@")) return new Response(JSON.stringify({ ok: true, action: "ignored", reason: "no_email" }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  const action = classify(status);
  if (action === "ignore") return new Response(JSON.stringify({ ok: true, action: "ignored", reason: "non_actionable_status", status }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let items = getInvoiceItems(payload);
  if (items.length === 0 && (productId || productName)) items = [{ id: productId, name: productName }];
  let groupIds: string[] = [];
  for (const it of items) {
    const { data: g } = await supabase.rpc("find_groups_for_eduzz_product", { p_product_id: it.id || null, p_product_name: it.name || null });
    if (Array.isArray(g)) groupIds.push(...(g as string[]));
  }
  groupIds = uniq(groupIds);
  console.log(`[webhook v28] itens=${items.length} grupos=${groupIds.length} fatura=${invoiceId || "-"} valor=${amountRaw || "-"}`);

  if (action === "paid" && groupIds.length === 0) {
    await supabase.from("enrolled_emails").upsert({
      email,
      notes: [`Eduzz IGNORADO: ${status}`, productName ? `produto=${productName}` : "", productId ? `prod_id=${productId}` : "", `itens=${items.length}`, "motivo=produto nao mapeia pra MDNM", `recv=${new Date().toISOString().slice(0, 19)}Z`].filter(Boolean).join(" | "),
      pending_group_ids: []
    }, { onConflict: "email" });
    return new Response(JSON.stringify({ ok: true, action: "ignored", reason: "product_not_mapped_to_mdnm", product: productName, product_id: productId, items: items.length, email }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let userId: string | null = null;
  let createdNewUser = false;
  const { data: existingId } = await supabase.rpc("get_user_id_by_email", { p_email: email });
  if (existingId) userId = existingId as string;

  if (action === "paid") {
    if (!userId) {
      try {
        const tmpPassword = generateStrongPassword();
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({ email, password: tmpPassword, email_confirm: true, user_metadata: { display_name: name || firstName(email) } });
        if (createErr) console.error("createUser error:", createErr); else if (created?.user?.id) { userId = created.user.id; createdNewUser = true; }
      } catch (e) { console.error("createUser exception:", e); }
    }

    const phoneE164 = normalizePhoneBR(phoneRaw);
    if (userId) {
      const updates: Record<string, any> = { user_id: userId };
      if (phoneE164) updates.phone = phoneE164;
      if (name) updates.display_name = name;
      if (Object.keys(updates).length > 1) {
        const { error: profErr } = await supabase.from("profiles").upsert(updates, { onConflict: "user_id" });
        if (profErr) console.warn("[webhook v28] profile upsert error:", profErr);
      }
    }

    // Libera o principal na hora e agenda os upsells pra +7 dias (drip).
    // Fallback: se a RPC nova falhar, libera TUDO na hora (nunca deixa aluna paga sem acesso).
    let appliedDirect = 0;
    let scheduledCount = 0;
    if (userId && groupIds.length > 0) {
      const { data: gsRes, error: gsErr } = await supabase.rpc("grant_or_schedule_groups", { p_user_id: userId, p_group_ids: groupIds, p_months: 12, p_delay_days: 7 });
      if (gsErr) {
        console.error("grant_or_schedule_groups failed, fallback grant-all:", gsErr);
        for (const gid of groupIds) {
          const { error: gErr } = await supabase.rpc("grant_access_with_expiry", { p_user_id: userId, p_group_id: gid, p_months: 12 });
          if (gErr) console.error(`grant_access_with_expiry failed for ${gid}:`, gErr); else appliedDirect++;
        }
      } else {
        const row = Array.isArray(gsRes) ? gsRes[0] : gsRes;
        appliedDirect = Number(row?.granted ?? 0);
        scheduledCount = Number(row?.scheduled ?? 0);
      }
    }

    const { data: existingEnrolled } = await supabase.from("enrolled_emails").select("pending_group_ids").eq("email", email).maybeSingle();
    const previousPending = (existingEnrolled?.pending_group_ids as string[] | null) || [];
    const mergedPending = uniq([...previousPending, ...groupIds]);
    const capiVal = parseAmount(amountRaw);
    await supabase.from("enrolled_emails").upsert({
      email,
      notes: [`Eduzz: ${status}`, name ? `nome=${name}` : "", productName ? `produto=${productName}` : "", productId ? `prod_id=${productId}` : "", `itens=${items.length}`, `grupos=${groupIds.length}`, `grupos_agendados=${scheduledCount}`, createdNewUser ? "conta_criada=sim" : (userId ? "user_existente=sim" : "user_existente=nao"), phoneE164 ? `tel=${phoneE164}` : "", `capi_id=${invoiceId || "-"}`, `capi_val=${capiVal ?? "-"}`, `rawprice=${JSON.stringify(payload.data?.price ?? "").slice(0, 90)}`, `rawpay=${JSON.stringify(payload.data?.payment ?? "").slice(0, 90)}`, `recv=${new Date().toISOString().slice(0, 19)}Z`].filter(Boolean).join(" | "),
      pending_group_ids: mergedPending
    }, { onConflict: "email" });

    let firstAccessEmail: any = { ok: false, reason: "not_attempted" };
    if (createdNewUser && userId) {
      const { data: tokenRow } = await supabase.from("first_access_tokens").insert({ user_id: userId, email, course_title: productName || "Medo de Dirigir Nunca Mais" }).select("token").single();
      if (tokenRow?.token) {
        firstAccessEmail = await sendBrevoFirstAccessEmail({ toEmail: email, toName: name || firstName(email), courseTitle: productName || "Medo de Dirigir Nunca Mais", firstAccessUrl: `${APP_URL}/primeiro-acesso/${tokenRow.token}` });
        await supabase.from("email_sends").insert({ user_id: userId, email, kind: "first_access", product_id: null, brevo_message_id: firstAccessEmail?.messageId || null });
      }
    }

    let whatsapp: any = { ok: false, reason: "not_attempted" };
    if (phoneE164) { whatsapp = await sendWhatsAppTemplate(phoneE164, name, productName || "Medo de Dirigir Nunca Mais"); }

    // CAPI: Purchase server-side (fire-and-forget; jamais derruba a criacao de conta acima).
    await sendCapiPurchase({ email, phone: phoneE164, name, eventId: invoiceId || `mddnm_${email}`, value: capiVal, productName: productName || "Medo de Dirigir Nunca Mais" });

    return new Response(JSON.stringify({ ok: true, action: "added", email, status, items: items.length, user_existed: !!userId && !createdNewUser, user_created: createdNewUser, groups_matched: groupIds.length, groups_applied_now: appliedDirect, groups_scheduled: scheduledCount, pending_total: mergedPending.length, first_access_email: firstAccessEmail.ok ? "sent" : (firstAccessEmail.reason || "failed"), brevo_message_id: firstAccessEmail?.messageId || null, whatsapp: whatsapp.ok ? "sent" : (whatsapp.reason || "failed"), phone_saved: !!phoneE164, capi_event_id: invoiceId || `mddnm_${email}`, capi_value: capiVal }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (action === "cancel") {
    let removedFromUser = 0;
    if (userId && groupIds.length > 0) {
      for (const gid of groupIds) {
        const { error: delErr, count } = await supabase.from("access_group_users").delete({ count: "exact" }).eq("user_id", userId).eq("group_id", gid);
        if (!delErr && count) removedFromUser += count;
      }
      // tambem cancela agendamentos pendentes desses grupos (drip)
      await supabase.from("scheduled_group_grants").delete().eq("user_id", userId).in("group_id", groupIds).is("granted_at", null);
    }
    return new Response(JSON.stringify({ ok: true, action: "removed", email, status, user_existed: !!userId, groups_removed_from_user: removedFromUser }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
});
