import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// =============================================================================
// whatsapp-suporte v1
//
// Webhook do WhatsApp Cloud API para o número de SUPORTE em COEXISTÊNCIA
// (5521993685289 · phone_number_id 1199065219959557 · WABA "Rodrigo Balla | FullStack").
//
// Por que existe: coexistência NÃO deixa criar templates, então não dá pra
// disparar a confirmação proativamente por esse número. A solução é REATIVA:
// a aluna toca no botão "Liberar acesso à plataforma" na página /obrigado, isso
// abre o WhatsApp e ela manda uma mensagem. Como ELA inicia, abre a janela de
// 24h e a gente pode responder LIVRE (sem template) com boas-vindas + botão de
// primeiro acesso.
//
// Fluxo:
//   GET  -> verificação do webhook (hub.challenge / hub.verify_token)
//   POST -> mensagem recebida -> casa telefone com aluna -> responde 1x com
//           boas-vindas (CTA botão pro link de primeiro acesso; fallback texto).
//
// verify_jwt = false (a Meta chama sem JWT do Supabase). Auth própria:
//   - GET: valida hub.verify_token.
//   - POST: valida assinatura X-Hub-Signature-256 SE WHATSAPP_APP_SECRET existir;
//           além disso só responde telefones que casam com aluna QUE AINDA precisa
//           do primeiro acesso (token pendente), e só UMA vez por telefone. Contato
//           antigo / aluna que já tem acesso => nada (o Balla atende manual no app).
//
// Secrets usados: WHATSAPP_SUPORTE_TOKEN (obrigatório, envio),
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN (default abaixo), WHATSAPP_APP_SECRET (opcional),
//   APP_URL (default .com.br), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPORTE_PHONE_ID = Deno.env.get("WHATSAPP_SUPORTE_PHONE_ID") || "1199065219959557";
const GRAPH_VERSION = "v21.0";
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "mddnm-suporte-verify-2026";
const APP_URL = (Deno.env.get("APP_URL") || "https://medodedirigirnuncamais.com.br").replace(/\/+$/, "");

function firstName(f: string): string {
  return (f || "").trim().split(/\s+/)[0] || "aluna";
}

// A aluna pode aparecer na Meta com ou sem o "9" após o DDD (bug histórico BR).
// Gera variantes pra casar com profiles.phone (salvo normalizado "55" + DDD + numero).
function phoneCandidates(from: string): string[] {
  const d = (from || "").replace(/\D/g, "");
  if (!d) return [];
  const set = new Set<string>([d]);
  let core = d.startsWith("55") ? d.slice(2) : d;
  if (core.length >= 10) {
    const ddd = core.slice(0, 2);
    const rest = core.slice(2);
    set.add("55" + ddd + rest);
    if (rest.length === 8) set.add("55" + ddd + "9" + rest); // adiciona o 9
    if (rest.length === 9 && rest.startsWith("9")) set.add("55" + ddd + rest.slice(1)); // remove o 9
  }
  if (!d.startsWith("55")) set.add("55" + d);
  return [...set];
}

async function verifySignature(appSecret: string, raw: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const expected = header.replace(/^sha256=/, "");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}

async function sendWelcome(to: string, nome: string, link: string): Promise<{ ok: boolean; reason?: string }> {
  const token = Deno.env.get("WHATSAPP_SUPORTE_TOKEN");
  if (!token) return { ok: false, reason: "missing_suporte_token" };
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${SUPORTE_PHONE_ID}/messages`;
  const bodyText =
    `Parabéns ${nome} 🎉 Sua matrícula no Escola de Condutores foi confirmada. ` +
    `Eu sou o Balla, seu suporte por aqui, qualquer dúvida é só me chamar nesse número.\n\n` +
    `Pra começar, é só tocar no botão pra criar sua senha e fazer o primeiro acesso. Bons estudos! 🚗`;

  // 1) Tenta mensagem interativa com botão CTA (dentro da janela de 24h, sem template).
  const interactive = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: bodyText },
      action: { name: "cta_url", parameters: { display_text: "Liberar meu acesso", url: link } },
    },
  };
  const r1 = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(interactive) });
  if (r1.ok) return { ok: true };
  const err1 = await r1.text().catch(() => "");
  console.warn(`[whatsapp-suporte] interativo falhou (${r1.status}), tentando texto. err=${err1.slice(0, 300)}`);

  // 2) Fallback: texto puro com o link (o WhatsApp deixa o link clicável).
  const textMsg = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body: `${bodyText}\n\n👉 ${link}` },
  };
  const r2 = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(textMsg) });
  if (r2.ok) return { ok: true };
  const err2 = await r2.text().catch(() => "");
  return { ok: false, reason: `send_failed: ${r2.status} ${err2.slice(0, 300)}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // --- Verificação do webhook (Meta chama GET uma vez na configuração) ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const raw = await req.text();

  // Assinatura opcional (só valida se o app secret estiver configurado).
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (appSecret) {
    const ok = await verifySignature(appSecret, raw, req.headers.get("x-hub-signature-256"));
    if (!ok) {
      console.warn("[whatsapp-suporte] assinatura inválida");
      return new Response("invalid signature", { status: 401 });
    }
  }

  let payload: any = {};
  try { payload = JSON.parse(raw); } catch { return new Response("ok", { status: 200 }); }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value) continue;
        // Só reage a mensagens recebidas (ignora statuses de entrega/leitura).
        const messages = value?.messages;
        if (!Array.isArray(messages) || messages.length === 0) continue;
        // Só o número de suporte (evita agir se o app receber eventos de outra WABA).
        if (value?.metadata?.phone_number_id && value.metadata.phone_number_id !== SUPORTE_PHONE_ID) continue;

        for (const msg of messages) {
          const from: string = String(msg?.from || "");
          if (!from) continue;

          // 1) Casa telefone -> aluna.
          const candidates = phoneCandidates(from);
          const { data: prof } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("phone", candidates)
            .limit(1)
            .maybeSingle();
          if (!prof?.user_id) {
            console.log(`[whatsapp-suporte] telefone ${from} não casou com aluna (o Balla atende no app).`);
            continue;
          }
          const userId = prof.user_id as string;

          // 2) Idempotência PERMANENTE: cada aluna recebe boas-vindas UMA vez só.
          //    Se já enviamos pra esse telefone, o Balla atende manual no app.
          const { data: log } = await supabase.from("whatsapp_welcome_log").select("sent_at").eq("phone", from).maybeSingle();
          if (log?.sent_at) {
            console.log(`[whatsapp-suporte] já enviei boas-vindas pra ${from} antes, pulando (Balla atende).`);
            continue;
          }

          // 3) SÓ responde quem AINDA precisa do primeiro acesso: precisa existir um
          //    token de primeiro acesso NÃO usado e NÃO expirado (aluna nova que
          //    acabou de comprar). Aluna que já criou a senha, contato antigo ou
          //    qualquer um que já tem acesso NÃO recebe o automático — o Balla
          //    atende manual no app. Não criamos token aqui de propósito.
          const { data: existing } = await supabase
            .from("first_access_tokens")
            .select("token")
            .eq("user_id", userId)
            .is("used_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const token = (existing?.token as string) || null;
          if (!token) {
            console.log(`[whatsapp-suporte] ${from} (aluna ${userId}) sem primeiro acesso pendente — já tem acesso. Balla atende manual.`);
            continue;
          }

          // 4) Nome pra personalizar.
          const nome = firstName((prof.display_name as string) || "");

          const link = `${APP_URL}/primeiro-acesso/${token}`;

          // 5) Envia boas-vindas + link.
          const sent = await sendWelcome(from, nome, link);
          console.log(`[whatsapp-suporte] aluna=${userId} from=${from} enviado=${sent.ok} ${sent.reason || ""}`);

          if (sent.ok) {
            await supabase.from("whatsapp_welcome_log").upsert({ phone: from, user_id: userId, sent_at: new Date().toISOString() }, { onConflict: "phone" });
          }
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp-suporte] erro processando:", e instanceof Error ? e.message : String(e));
  }

  // Sempre 200 rápido pra Meta não re-tentar.
  return new Response("ok", { status: 200, headers: { ...CORS, "Content-Type": "text/plain" } });
});
