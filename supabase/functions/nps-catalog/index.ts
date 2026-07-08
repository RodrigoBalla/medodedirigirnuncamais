import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─── nps-catalog ─────────────────────────────────────────────────────────────
// Cataloga as respostas abertas da Pesquisa NPS com IA (Claude):
//   • sentimento (positive/neutral/negative)
//   • temas curtos (ex.: "didática", "quer aulas ao vivo", "ansiedade")
//   • resumo de 1 frase
// Só admin. Usa service role pra ler/gravar. Precisa do secret ANTHROPIC_API_KEY.
// action="catalog_all" → processa todas as respostas ainda não catalogadas.
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

interface Item { id: string; nps_score: number; reason?: string; missing?: string; testimonial?: string; wants_more?: string[] }

async function classify(apiKey: string, items: Item[]): Promise<Record<string, { sentiment: string; themes: string[]; summary: string }>> {
  const prompt =
    `Você é analista de pesquisa de satisfação de um curso online para MULHERES que têm MEDO DE DIRIGIR.\n` +
    `Para CADA resposta abaixo, classifique:\n` +
    `- sentiment: "positive", "neutral" ou "negative"\n` +
    `- themes: 1 a 3 temas CURTOS em português (2-3 palavras), ex: "didática ótima", "quer aulas ao vivo", "ansiedade no volante", "preço", "quer mais prática", "suporte".\n` +
    `- summary: 1 frase curta resumindo a resposta.\n` +
    `Considere a nota (nps_score 0-10) junto do texto.\n` +
    `Responda SOMENTE com um array JSON válido, sem texto fora dele, no formato:\n` +
    `[{"id":"<id>","sentiment":"...","themes":["...","..."],"summary":"..."}]\n\n` +
    `Respostas:\n${JSON.stringify(items)}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`anthropic_${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  const text: string = data?.content?.[0]?.text || "";
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0) throw new Error("no_json_in_response");
  const arr = JSON.parse(text.slice(start, end + 1)) as Array<{ id: string; sentiment: string; themes: string[]; summary: string }>;
  const out: Record<string, { sentiment: string; themes: string[]; summary: string }> = {};
  for (const x of arr) {
    if (!x?.id) continue;
    const s = String(x.sentiment || "").toLowerCase();
    out[x.id] = {
      sentiment: ["positive", "neutral", "negative"].includes(s) ? s : "neutral",
      themes: Array.isArray(x.themes) ? x.themes.map((t) => String(t).slice(0, 40)).slice(0, 3) : [],
      summary: String(x.summary || "").slice(0, 240),
    };
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  // 1. Admin?
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: role } = await svc.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "forbidden" }, 403);

  if (!apiKey) return json({ error: "missing_api_key" }, 400);

  // 2. Pega respostas ainda não catalogadas
  const { data: rows, error } = await svc
    .from("nps_responses")
    .select("id, nps_score, reason, missing, testimonial, wants_more")
    .is("ai_processed_at", null)
    .limit(60);
  if (error) return json({ error: "db_error", detail: error.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: true, processed: 0 });

  const items: Item[] = rows.map((r: any) => ({
    id: r.id,
    nps_score: r.nps_score,
    reason: r.reason || undefined,
    missing: r.missing || undefined,
    testimonial: r.testimonial || undefined,
    wants_more: r.wants_more || undefined,
  }));

  let results: Record<string, { sentiment: string; themes: string[]; summary: string }>;
  try {
    results = await classify(apiKey, items);
  } catch (e) {
    console.error("[nps-catalog] classify failed:", e);
    return json({ error: "ai_failed", detail: String(e) }, 500);
  }

  // 3. Grava
  let processed = 0;
  for (const it of items) {
    const res = results[it.id];
    const patch = res
      ? { ai_sentiment: res.sentiment, ai_themes: res.themes, ai_summary: res.summary, ai_processed_at: new Date().toISOString() }
      // sem retorno da IA: fallback pelo score, marca processado pra não travar
      : { ai_sentiment: it.nps_score >= 9 ? "positive" : it.nps_score <= 6 ? "negative" : "neutral", ai_themes: [], ai_summary: null, ai_processed_at: new Date().toISOString() };
    const { error: upErr } = await svc.from("nps_responses").update(patch).eq("id", it.id);
    if (!upErr) processed++;
  }

  return json({ ok: true, processed });
});
