import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie,
} from "recharts";
import { npsDb, npsLabel } from "@/lib/nps";

// ─── NpsTab ──────────────────────────────────────────────────────────────────
// Aba "Pesquisa NPS" do admin: KPIs + gráficos (recharts) gerados na hora a
// partir de admin_nps_summary(), + tabela completa de respostas (admin_nps_responses)
// com as tags de IA. Botão pra (re)catalogar as respostas abertas com IA.
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

const PRIMARY = "#FFD60A";
const toArr = (obj: Record<string, number> | undefined) =>
  Object.entries(obj || {}).map(([k, v]) => ({ name: npsLabel(k), value: v })).sort((a, b) => b.value - a.value);

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-3xl font-black mt-1 ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{title}</p>
      {children}
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
      const [s, r] = await Promise.all([
        npsDb.rpc("admin_nps_summary"),
        npsDb.rpc("admin_nps_responses"),
      ]);
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
      const res = await supabase.functions.invoke("nps-catalog", {
        body: { action: "catalog_all" },
      });
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
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const total = summary?.total ?? 0;

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📊</div>
        <h3 className="font-black text-lg">Nenhuma resposta ainda</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Assim que as alunas responderem a pesquisa, os gráficos aparecem aqui na hora.
        </p>
      </div>
    );
  }

  const npsColor = summary!.nps >= 50 ? "text-emerald-500" : summary!.nps >= 0 ? "text-primary" : "text-destructive";
  const beforeAfter = [
    { name: "Antes", value: Number(summary!.fear_before) },
    { name: "Agora", value: Number(summary!.fear_after) },
  ];
  const npsSegments = [
    { name: "Promotoras", value: summary!.promoters, fill: "#10b981" },
    { name: "Neutras", value: summary!.passives, fill: "#94a3b8" },
    { name: "Detratoras", value: summary!.detractors, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Pesquisa NPS ({total} respostas)</h2>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">NPS</p>
          <p className={`text-3xl font-black mt-1 ${npsColor}`}>{summary!.nps}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{summary!.nps >= 70 ? "Excelente" : summary!.nps >= 50 ? "Ótimo" : summary!.nps >= 0 ? "Ok" : "Atenção"}</p>
        </div>
        <Kpi label="Nota média" value={summary!.avg_score} sub="de 0 a 10" accent />
        <Kpi label="Medo antes → agora" value={`${summary!.fear_before} → ${summary!.fear_after}`} sub="escala 1-5 (maior = melhor)" accent />
        <Kpi label="Depoimentos" value={summary!.testimonials} sub="com autorização de uso" accent />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Distribuição das notas (0-10)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary!.score_dist}>
              <XAxis dataKey="score" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {summary!.score_dist.map((d) => (
                  <Cell key={d.score} fill={d.score >= 9 ? "#10b981" : d.score >= 7 ? "#94a3b8" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Promotoras / Neutras / Detratoras">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={npsSegments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: ${e.value}`} labelLine={false}>
                {npsSegments.map((s) => <Cell key={s.name} fill={s.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Transformação: medo antes → agora">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={beforeAfter}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                <Cell fill="#ef4444" /><Cell fill="#10b981" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="O que querem ver mais">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={toArr(summary!.wants)} margin={{ left: 10 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill={PRIMARY} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Já está dirigindo?">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={toArr(summary!.driving)} margin={{ left: 10 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill={PRIMARY} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="O que mais gostaram">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={toArr(summary!.liked)} margin={{ left: 10 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill={PRIMARY} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Temas da IA (se houver) */}
      {Object.keys(summary!.themes || {}).length > 0 && (
        <ChartCard title="🤖 Temas detectados pela IA">
          <ResponsiveContainer width="100%" height={Math.max(140, toArr(summary!.themes).length * 34)}>
            <BarChart layout="vertical" data={toArr(summary!.themes)} margin={{ left: 10 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip cursor={{ fill: "rgba(255,214,10,0.08)" }} contentStyle={{ background: "#0B1A38", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill={PRIMARY} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Tabela de respostas */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Todas as respostas</p>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="border border-border rounded-xl p-3.5 bg-background/40">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm truncate">{r.display_name}</span>
                  {r.email && <span className="text-[11px] text-muted-foreground truncate">{r.email}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${r.nps_score >= 9 ? "bg-emerald-500/15 text-emerald-500" : r.nps_score >= 7 ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive"}`}>
                    Nota {r.nps_score}
                  </span>
                  {r.ai_sentiment && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.ai_sentiment === "positive" ? "bg-emerald-500/15 text-emerald-500" : r.ai_sentiment === "negative" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {npsLabel(r.ai_sentiment)}
                    </span>
                  )}
                </div>
              </div>
              {r.ai_summary && <p className="text-xs text-primary/90 italic mb-1.5">🤖 {r.ai_summary}</p>}
              {(r.ai_themes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.ai_themes!.map((t) => <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>)}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground mb-2">
                {r.fear_before != null && <span>Medo: {r.fear_before} → {r.fear_after ?? "?"}</span>}
                {r.driving_status && <span>{npsLabel(r.driving_status)}</span>}
                {r.continue_interest && <span>Continuar: {npsLabel(r.continue_interest)}</span>}
              </div>
              {r.reason && <p className="text-xs text-foreground mb-1"><span className="text-muted-foreground">Motivo:</span> {r.reason}</p>}
              {r.missing && <p className="text-xs text-foreground mb-1"><span className="text-muted-foreground">Faltou:</span> {r.missing}</p>}
              {r.testimonial && (
                <p className="text-xs text-foreground mt-1.5 border-l-2 border-primary/40 pl-2 italic">
                  "{r.testimonial}" {r.testimonial_consent && <span className="not-italic text-emerald-500 font-bold text-[10px]">✓ pode usar</span>}
                </p>
              )}
              {(r.wants_more?.length ?? 0) > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1.5">Quer: {r.wants_more.map(npsLabel).join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
