// ════════════════════════════════════════════════════════════════
// Edge Function: panda-jwt
// Assina um JWT (HS256) que vai como `&watermark={JWT}` na URL do
// iframe Panda Video. O JWT carrega:
//   - drm_group_id: ID do grupo DRM Watermark (env PANDA_DRM_GROUP_ID)
//   - string1: "Aluno · Medo de Dirigir Nunca Mais"
//   - string2: email do aluno (renderizado sobre o vídeo)
//   - string3: ID curto da sessão (rastreio)
// Expira em 1h (token rotativo — limita janela de compartilhamento).
//
// SECURITY:
// - Requer Authorization Bearer com JWT do Supabase Auth
// - Extrai o usuário autenticado e usa o email/id na watermark
// - Nunca expõe a chave secreta (fica no env do servidor)
// ════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  // 1. Valida usuário autenticado
  const auth = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse(500, { error: "supabase_not_configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  // 2. Lê configuração do Panda DRM
  const drmGroupId = Deno.env.get("PANDA_DRM_GROUP_ID");
  const drmSecret  = Deno.env.get("PANDA_DRM_SECRET");
  if (!drmGroupId || !drmSecret) {
    console.error("[panda-jwt] PANDA_DRM_GROUP_ID/SECRET ausentes no env");
    return jsonResponse(500, { error: "drm_not_configured" });
  }

  // 3. Monta payload da watermark
  const email = user.email || "(sem email)";
  const userIdShort = (user.id || "").slice(0, 8);
  const payload = {
    drm_group_id: drmGroupId,
    string1: "Medo de Dirigir Nunca Mais",
    string2: email,
    string3: `ID: ${userIdShort}`,
    exp: getNumericDate(60 * 60), // 1h — token rotativo
  };

  // 4. Assina HS256 com a chave secreta do Panda
  try {
    const keyData = new TextEncoder().encode(drmSecret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    const token = await create({ alg: "HS256", typ: "JWT" }, payload, cryptoKey);
    return jsonResponse(200, { ok: true, token });
  } catch (err) {
    console.error("[panda-jwt] sign failed:", err);
    return jsonResponse(500, { error: "sign_failed", detail: String(err) });
  }
});
