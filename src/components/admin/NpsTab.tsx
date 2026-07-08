import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { npsDb, npsLabel } from "@/lib/nps";

// ─── NpsTab ──────────────────────────────────────────────────────────────────
// Aba "Pesquisa NPS" do admin. Objetivo: LEITURA RÁPIDA e intuitiva.
// Poucos visuais, cada um com uma legenda em português explicando o que é.
// =============================================================================

interface Summary {
  total: number; nps: number; promoters: number; passives: number; detractors: number;
  avg_score: number; fear_before: number; fear_after: number; testimonials: number;
  score_dist: { score: number; count: number }[];
  driving: Record<string, number>; continue: Record<string, number>;
  liked: Record<string, number>; wants: Record<string, number>;
  sentiment: Record<string, number>; themes: Record<string, number>;
}

interface ResponseRow {
  id: string; display_name: string; email: string | null;
  nps_score: number; reason: string | null; fear_before: number | null; fear_after: number | null;
  driving_status: string | null; liked_most: string[]; wants_more: string[]; missing: string | null;
  testimonial: string | null; testimonial_consent: boolean; continue_interest: string | null;
  ai_sentiment: string | null; ai_themes: string[] | null; ai_summary: string | null; created_at: string;
}

const GREEN = "#10b981", GRAY = "#94a3b8", RED = "#ef4444", PRIMARY = "#FFD60A";
const num = (n: number) => String(n).replace(".", ",");
const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);
const toArr = (obj: Record<string, number> | undefined) =>
  Object.entries(obj || {}).filter(([k]) => k !== "?").map(([k, v]) => ({ name: npsLabel(k), value: v })).sort((a, b) => b.value - a.value);

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-3xl font-black mt-1 ${tone || "text-primary"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{title}</p>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-3 leading-snug border-t border-border pt-2">{hint}</p>}
    </div>
  );
}

// Barra horizontal simples com rótulo + contagem (mais legível que gráfico).
function HBars({ data, empty }: { data: { name: string; value: number }[]; empty?: string }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">{empty || "Sem dados ainda."}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-2.5">
          <span className="w-28 sm:w-36 shrink-0 text-[11px] text-foreground text-right leading-tight">{d.name}</span>
          <div className="flex-1 h-6 bg-muted/60 rounded-md overflow-hidden">
            <div className="h-full bg-primary rounded-md transition-all" style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 6 : 0 }} />
          </div>
          <span className="w-5 shrink-0 text-[11px] font-black text-foreground tabular-nums text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function NpsTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cataloging, setCataloging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([npsDb.rpc("admin_nps_summary"), npsDb.rpc("admin_nps_responses")]);
      if (s.data) setSummary(s.data as Summary);
      if (Array.isArray(r.data)) setRows(r.data as ResponseRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function catalog() {
    setCataloging(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const res = await supabase.functions.invoke("nps-catalog", { body: { action: "catalog_all" } });
      if (res.error || res.data?.error) {
        toast.error("Não consegui catalogar", {
          description: res.data?.error === "missing_api_key"
            ? "Falta configurar a chave da IA no Supabase (secret OPENAI_API_KEY)."
            : res.error?.message || res.data?.error || "Tente de novo",
        });
        return;
      }
      toast.success(`IA catalogou ${res.data?.processed ?? 0} respostas`);
      await load();
    } finally {
      setCataloging(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const total = summary?.total ?? 0;
  if (!summary || total === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📊</div>
        <h3 className="font-black text-lg">Nenhuma resposta ainda</h3>
        <p className="text-sm text-muted-foreground mt-1">Assim que as alunas responderem, os gráficos aparecem aqui na hora.</p>
      </div>
    );
  }

  const npsTone = summary.nps >= 50 ? "text-emerald-500" : summary.nps >= 0 ? "text-primary" : "text-destructive";
  const npsVerdict = summary.nps >= 70 ? "Excelente" : summary.nps >= 50 ? "Ótimo" : summary.nps >= 0 ? "Ok, dá pra melhorar" : "Precisa de atenção";
  const drivingNow = (summary.driving["sozinha"] || 0) + (summary.driving["acompanhada"] || 0);
  const improvement = Number(summary.fear_after) - Number(summary.fear_before);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Pesquisa NPS · {total} resposta{total === 1 ? "" : "s"}</h2>
        <div className="flex gap-2">
          <button onClick={catalog} disabled={cataloging}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-colors disabled:opacity-50">
            {cataloging ? <span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-base">auto_awesome</span>}
            Catalogar com IA
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 bg-accent rounded-lg text-sm font-medium hover:bg-accent/80 transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
            Atualizar
          </button>
        </div>
      </div>

      {/* KPIs — os 4 números que importam */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="NPS" value={summary.nps} sub={npsVerdict} tone={npsTone} />
        <Kpi label="Nota média" value={num(summary.avg_score)} sub="de 0 a 10" />
        <Kpi label="Já estão dirigindo" value={`${pct(drivingNow, total)}%`} sub={`${drivingNow} de ${total} alunas`} />
        <Kpi label="Depoimentos" value={summary.testimonials} sub="liberados pra usar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Composição do NPS — barra empilhada (troca a pizza confusa) */}
        <Card title="Do que vem o NPS" hint={`NPS = % de promotoras (nota 9-10) menos % de detratoras (nota 0-6). As neutras (7-8) não contam. Aqui deu ${summary.nps}.`}>
          <div className="flex h-9 rounded-lg overflow-hidden text-[11px] font-black">
            {summary.promoters > 0 && <div style={{ width: `${pct(summary.promoters, total)}%`, background: GREEN }} className="flex items-center justify-center text-white" title="Promotoras">{summary.promoters}</div>}
            {summary.passives > 0 && <div style={{ width: `${pct(summary.passives, total)}%`, background: GRAY }} className="flex items-center justify-center text-white" title="Neutras">{summary.passives}</div>}
            {summary.detractors > 0 && <div style={{ width: `${pct(summary.detractors, total)}%`, background: RED }} className="flex items-center justify-center text-white" title="Detratoras">{summary.detractors}</div>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: GREEN }} />Promotoras (9-10): <b>{summary.promoters}</b> · {pct(summary.promoters, total)}%</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: GRAY }} />Neutras (7-8): <b>{summary.passives}</b></span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: RED }} />Detratoras (0-6): <b>{summary.detractors}</b> · {pct(summary.detractors, total)}%</span>
          </div>
        </Card>

        {/* A transformação — Antes → Agora, grandão e óbvio */}
        <Card title="A transformação (o número de ouro)" hint="Média de quão seguras elas se sentem dirigindo, de 1 (travava) a 5 (tranquila). Quanto maior o salto, mais forte seu case de venda.">
          <div className="flex items-center justify-around gap-2 py-3">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Antes</p>
              <p className="text-4xl font-black text-muted-foreground">{num(summary.fear_before)}</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-primary text-3xl">trending_flat</span>
              {improvement > 0 && <span className="text-xs font-black text-emerald-500">+{num(Number(improvement.toFixed(1)))}</span>}
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-primary mb-1">Agora</p>
              <p className="text-4xl font-black text-primary">{num(summary.fear_after)}</p>
            </div>
          </div>
        </Card>

        {/* Distribuição das notas — único gráfico recharts, o clássico */}
        <Card title="Quantas deram cada nota" hint="Cada barra = quantas alunas deram aquela nota. Verde = promotoras, cinza = neutras, vermelho = detratoras.">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={summary.score_dist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="score" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: any) => [`${v} aluna(s)`, "Notas"]} labelFormatter={(l) => `Nota ${l}`} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {summary.score_dist.map((d) => <Cell key={d.score} fill={d.score >= 9 ? GREEN : d.score >= 7 ? GRAY : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Já dirige */}
        <Card title="Onde as alunas estão hoje" hint="Situação atual de cada aluna com o volante.">
          <HBars data={toArr(summary.driving)} />
        </Card>

        {/* O que querem mais — roadmap */}
        <Card title="O que a base mais quer ver" hint="O que elas mais pediram — seu próximo passo de produto, direto da boca da aluna.">
          <HBars data={toArr(summary.wants)} />
        </Card>

        {/* O que mais gostaram */}
        <Card title="O que elas mais amaram" hint="Seus pontos fortes — use isso no marketing e na página de vendas.">
          <HBars data={toArr(summary.liked)} />
        </Card>
      </div>

      {/* Temas da IA (só se já catalogou) */}
      {Object.keys(summary.themes || {}).length > 0 && (
        <Card title="🤖 Temas que a IA encontrou" hint="Assuntos que mais apareceram nas respostas abertas, agrupados pela IA.">
          <HBars data={toArr(summary.themes)} />
        </Card>
      )}

      {/* Tabela de respostas */}
      <Card title="Todas as respostas">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="border border-border rounded-xl p-3.5 bg-background/40">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm truncate">{r.display_name}</span>
                  {r.email && <span className="text-[11px] text-muted-foreground truncate">{r.email}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${r.nps_score >= 9 ? "bg-emerald-500/15 text-emerald-500" : r.nps_score >= 7 ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive"}`}>Nota {r.nps_score}</span>
                  {r.ai_sentiment && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.ai_sentiment === "positive" ? "bg-emerald-500/15 text-emerald-500" : r.ai_sentiment === "negative" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{npsLabel(r.ai_sentiment)}</span>
                  )}
                </div>
              </div>
              {r.ai_summary && <p className="text-xs text-primary/90 italic mb-1.5">🤖 {r.ai_summary}</p>}
              {(r.ai_themes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.ai_themes!.map((t) => <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>)}
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-1">
                {r.fear_before != null && <span>Confiança: {r.fear_before} → {r.fear_after ?? "?"}</span>}
                {r.driving_status && <span>· {npsLabel(r.driving_status)}</span>}
                {r.continue_interest && <span>· Continuar: {npsLabel(r.continue_interest)}</span>}
              </div>
              {r.reason && <p className="text-xs text-foreground mb-1"><span className="text-muted-foreground">Motivo:</span> {r.reason}</p>}
              {r.missing && <p className="text-xs text-foreground mb-1"><span className="text-muted-foreground">Faltou:</span> {r.missing}</p>}
              {r.testimonial && (
                <p className="text-xs text-foreground mt-1.5 border-l-2 border-primary/40 pl-2 italic">
                  "{r.testimonial}" {r.testimonial_consent && <span className="not-italic text-emerald-500 font-bold text-[10px]">✓ pode usar</span>}
                </p>
              )}
              {(r.wants_more?.length ?? 0) > 0 && <p className="text-[11px] text-muted-foreground mt-1.5">Quer: {r.wants_more.map(npsLabel).join(", ")}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
