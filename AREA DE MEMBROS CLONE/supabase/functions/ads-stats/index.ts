import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ads-stats v11 — sobre v10: reembolsos.por_produto (quais produtos foram
// reembolsados + quantidade) pro painel mostrar tags vermelhas por produto.
// v10: compras com enrolled_emails.refunded_at não NULL saem da receita/contagem
// (receita_total/hoje viram LÍQUIDAS) e entram no bloco `reembolsos` (contador +
// valor). Assim o reembolso é "extraído do lucro" (Resultado = receita líquida −
// gasto). Escopo = janela da campanha (desde 21/07), igual ao resto do placar.
// AUTH: ?k=DASH_KEY OU Bearer JWT de admin (user_roles). Meta: cache 60s.

const DASH_KEY = "mdnm-trafego-x7k92f4q8b";
const ACCOUNT = "act_1256121335670885";
const CAMPAIGN_ID = "120249309971940043";
const CAMPAIGN_START_SP = "2026-07-21";
const GRAPH = "v21.0";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };

function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
function num(v: unknown): number { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; }
function pickAction(arr: any[], kind: string): number {
  if (!Array.isArray(arr)) return 0;
  const it = arr.find((a) => String(a?.action_type || "").includes(kind));
  return it ? num(it.value) : 0;
}

async function metaGet(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${path}?${qs}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `meta_http_${r.status}`);
  return j;
}

const g = globalThis as any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let ok = url.searchParams.get("k") === DASH_KEY;
  if (!ok) {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (jwt) {
      try {
        const { data: u } = await svc.auth.getUser(jwt);
        if (u?.user?.id) {
          const { data: role } = await svc.from("user_roles").select("role").eq("user_id", u.user.id).in("role", ["admin", "support"]).maybeSingle();
          ok = !!role;
        }
      } catch (_) { /* nega */ }
    }
  }
  if (!ok) return json({ error: "forbidden" }, 403);

  const out: Record<string, unknown> = { ts: new Date().toISOString(), inicio: CAMPAIGN_START_SP };

  try {
    const now = new Date();
    const sp = new Date(now.getTime() - 3 * 3600e3);
    const startToday = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3, 0, 0)).toISOString();
    const startTodayMs = new Date(startToday).getTime();
    const [y, mo, d] = CAMPAIGN_START_SP.split("-").map(Number);
    const startCampaign = new Date(Date.UTC(y, mo - 1, d, 3, 0, 0)).toISOString();
    const { data } = await svc.from("enrolled_emails")
      .select("email, enrolled_at, notes, refunded_at")
      .gte("enrolled_at", startCampaign)
      .order("enrolled_at", { ascending: false })
      .limit(500);
    const all = (data || []).filter((r: any) => !String(r.notes || "").startsWith("Eduzz IGNORADO"));
    const val = (r: any) => { const m = String(r.notes || "").match(/capi_val=([0-9.]+)/); return m ? num(m[1]) : 0; };
    const nome = (r: any) => { const m = String(r.notes || "").match(/nome=([^|]+)/); return m ? m[1].trim() : null; };
    const isRef = (r: any) => !!r.refunded_at;
    const rows = all.filter((r: any) => !isRef(r));   // vendas líquidas (não reembolsadas)
    const refunded = all.filter(isRef);               // reembolsos (compras da campanha)
    const today = rows.filter((r: any) => r.enrolled_at >= startToday);
    // "reembolsos hoje" = processados hoje (por refunded_at), não pela data da compra
    const refToday = refunded.filter((r: any) => new Date(r.refunded_at).getTime() >= startTodayMs);
    // Reembolsos por produto: quais produtos foram reembolsados + quantidade.
    // Nome do produto vem do notes (produto=<nome> | itens=...); o nome pode ter " | "
    // interno (ex: "... + atualizações | Combo"), por isso casa até " | itens=".
    const prodName = (r: any) => { const mm = String(r.notes || "").match(/produto=(.+?)\s*\|\s*itens=/); return mm ? mm[1].trim() : "Outro"; };
    const porProdutoMap: Record<string, { produto: string; qtd: number; valor: number }> = {};
    for (const r of refunded) {
      const p = prodName(r);
      if (!porProdutoMap[p]) porProdutoMap[p] = { produto: p, qtd: 0, valor: 0 };
      porProdutoMap[p].qtd++;
      porProdutoMap[p].valor += val(r);
    }
    const porProduto = Object.values(porProdutoMap).sort((a, b) => (b.qtd - a.qtd) || (b.valor - a.valor));
    out.vendas = {
      hoje: today.length,
      receita_hoje: today.reduce((s: number, r: any) => s + val(r), 0),
      total: rows.length,
      receita_total: rows.reduce((s: number, r: any) => s + val(r), 0),
      reembolsos: {
        total: refunded.length,
        valor: refunded.reduce((s: number, r: any) => s + val(r), 0),
        hoje: refToday.length,
        valor_hoje: refToday.reduce((s: number, r: any) => s + val(r), 0),
        por_produto: porProduto,
      },
      lista: rows.slice(0, 10).map((r: any) => ({ email: r.email, nome: nome(r), quando: r.enrolled_at, valor: val(r) || null })),
    };
  } catch (e) { out.vendas = { error: e instanceof Error ? e.message : String(e) }; }

  const token = Deno.env.get("META_ADS_TOKEN") || "";
  if (!token) {
    out.meta = { error: "missing_token" };
  } else if (g._metaCache && Date.now() - g._metaCache.t < 60_000) {
    out.meta = g._metaCache.data;
    (out.meta as any).cache = true;
  } else {
    try {
      const fields = "spend,impressions,clicks,ctr,cpm,actions,action_values";
      const base = { level: "account", filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: [CAMPAIGN_ID] }]) };
      const adFields = { level: "ad", fields: "ad_name,spend,impressions,clicks,actions", filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: [CAMPAIGN_ID] }]), limit: "50" };
      const [hoje, total, adsHoje, adsTotal] = await Promise.all([
        metaGet(`${ACCOUNT}/insights`, { ...base, date_preset: "today", fields }, token),
        metaGet(`${ACCOUNT}/insights`, { ...base, date_preset: "maximum", fields }, token),
        metaGet(`${ACCOUNT}/insights`, { ...adFields, date_preset: "today" }, token),
        metaGet(`${ACCOUNT}/insights`, { ...adFields, date_preset: "maximum" }, token),
      ]);
      const parse = (d: any) => {
        const r = d?.data?.[0] || {};
        return { gasto: num(r.spend), impressoes: num(r.impressions), cliques: num(r.clicks), ctr: num(r.ctr), cpm: num(r.cpm), compras: pickAction(r.actions, "purchase"), receita: pickAction(r.action_values, "purchase"), lpv: pickAction(r.actions, "landing_page_view") };
      };
      const parseAds = (d: any) => ((d?.data || []) as any[])
        .map((a: any) => ({ nome: a.ad_name, gasto: num(a.spend), impressoes: num(a.impressions), cliques: num(a.clicks), compras: pickAction(a.actions, "purchase") }))
        .filter((a: any) => a.gasto > 0 || a.impressoes > 0)
        .sort((a: any, b: any) => (b.compras - a.compras) || (b.gasto - a.gasto));
      const meta = { hoje: parse(hoje), total: parse(total), anuncios_hoje: parseAds(adsHoje), anuncios_total: parseAds(adsTotal) };
      g._metaCache = { t: Date.now(), data: meta };
      out.meta = meta;
    } catch (e) { out.meta = { error: e instanceof Error ? e.message : String(e) }; }
  }

  return json(out);
});
