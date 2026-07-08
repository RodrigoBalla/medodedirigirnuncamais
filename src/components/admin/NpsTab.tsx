import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { npsDb, npsLabel } from "@/lib/nps";

// ─── NpsTab ──────────────────────────────────────────────────────────────────
// Aba "Pesquisa NPS": cada bloco RESPONDE UMA PERGUNTA, empilhados de cima pra
// baixo (coluna única). Pergunta em cima, resposta em número + barra simples
// embaixo. Sem gráfico enfeitado — leitura de bater o olho.
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

const GREEN = "#10b981", GRAY = "#94a3b8", RED = "#ef4444";
const num = (n: number) => String(n).replace(".", ",");
const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);
const toArr = (obj: Record<string, number> | undefined) =>
  Object.entries(obj || {}).filter(([k]) => k !== "?").map(([k, v]) => ({ name: npsLabel(k), value: v })).sort((a, b) => b.value - a.value);

// Um bloco = uma pergunta respondida. Empilha vertical.
function Block({ n, question, answer, children, hint }: { n: number; question: string; answer?: React.ReactNode; children?: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="mt-0.5 size-6 shrink-0 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center">{n}</span>
        <h3 className="text-base font-black text-foreground leading-snug">{question}</h3>
      </div>
      {answer && <div className="mb-3 text-sm text-foreground" style={{ marginLeft: "2.125rem" }}>{answer}</div>}
      {children && <div>{children}</div>}
      {hint && <p className="text-[11px] text-muted-foreground mt-3 border-t border-border pt-2 leading-snug">{hint}</p>}
    </div>
  );
}

// Barra horizontal simples: rótulo · barra · número. Mais legível que gráfico.
function HBars({ data, empty }: { data: { name: string; value: number }[]; empty?: string }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground py-3 text-center">{empty || "Sem dados ainda."}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const totalV = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2.5">
          <span className="w-32 sm:w-40 shrink-0 text-xs text-foreground text-right leading-tight">{d.name}</span>
          <div className="flex-1 h-7 bg-muted/60 rounded-md overflow-hidden">
            <div className={`h-full rounded-md ${i === 0 ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 8 : 0 }} />
          </div>
          <span className="w-14 shrink-0 text-xs font-black text-foreground tabular-nums text-right">
            {d.value} <span className="font-medium text-muted-foreground">· {pct(d.value, totalV)}%</span>
          </span>
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
        <p className="text-sm text-muted-foreground mt-1">Assim que as alunas responderem, as respostas aparecem aqui na hora.</p>
      </div>
    );
  }

  const npsVerdict = summary.nps >= 70 ? "Excelente" : summary.nps >= 50 ? "Ótimo" : summary.nps >= 0 ? "Ok, dá pra melhorar" : "Precisa de atenção";
  const drivingNow = (summary.driving["sozinha"] || 0) + (summary.driving["acompanhada"] || 0);
  const improvement = Number(summary.fear_after) - Number(summary.fear_before);
  const wantsArr = toArr(summary.wants);
  const likedArr = toArr(summary.liked);
  const contSim = summary.continue["sim"] || 0;
  const themesArr = toArr(summary.themes);

  let bn = 0;
  const next = () => ++bn;

  return (
    <div className="max-w-2xl mx-auto space-y-3">
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

      {/* 1 · Recomendam? */}
      <Block n={next()} question="As alunas recomendam o curso pra uma amiga?"
        answer={<span><b className="text-xl text-emerald-500">{pct(summary.promoters, total)}%</b> recomendam de olho fechado — deram nota 9 ou 10. A nota média foi <b>{num(summary.avg_score)}</b> de 10.</span>}
        hint={`Em "linguajar de pesquisa" isso vira um NPS de ${summary.nps} (${npsVerdict}) — a conta é % de promotoras menos % de detratoras; acima de 50 já é ótimo.`}>
        <div className="flex h-9 rounded-lg overflow-hidden text-[11px] font-black mb-2">
          {summary.promoters > 0 && <div style={{ width: `${pct(summary.promoters, total)}%`, background: GREEN }} className="flex items-center justify-center text-white">{summary.promoters}</div>}
          {summary.passives > 0 && <div style={{ width: `${pct(summary.passives, total)}%`, background: GRAY }} className="flex items-center justify-center text-white">{summary.passives}</div>}
          {summary.detractors > 0 && <div style={{ width: `${pct(summary.detractors, total)}%`, background: RED }} className="flex items-center justify-center text-white">{summary.detractors}</div>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: GREEN }} />Recomendam muito (9-10): <b>{summary.promoters}</b></span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: GRAY }} />Neutras (7-8): <b>{summary.passives}</b></span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: RED }} />Insatisfeitas (0-6): <b>{summary.detractors}</b></span>
        </div>
      </Block>

      {/* 2 · Ficaram mais seguras? */}
      <Block n={next()} question="Elas ficaram mais seguras dirigindo?"
        answer={improvement > 0
          ? <span>Sim — a confiança subiu de <b>{num(summary.fear_before)}</b> pra <b className="text-emerald-500">{num(summary.fear_after)}</b> (numa escala de 1 a 5).</span>
          : <span>Confiança: antes <b>{num(summary.fear_before)}</b>, agora <b>{num(summary.fear_after)}</b>.</span>}
        hint="Média do quanto elas se sentem seguras no volante. 1 = travava de medo · 5 = dirige tranquila. Esse salto é seu case de venda mais forte.">
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Antes</p>
            <p className="text-4xl font-black text-muted-foreground">{num(summary.fear_before)}</p>
          </div>
          <div className="flex flex-col items-center">
            <span className="material-symbols-outlined text-primary text-4xl">trending_flat</span>
            {improvement > 0 && <span className="text-sm font-black text-emerald-500">+{num(Number(improvement.toFixed(1)))}</span>}
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-primary mb-1">Agora</p>
            <p className="text-4xl font-black text-primary">{num(summary.fear_after)}</p>
          </div>
        </div>
      </Block>

      {/* 3 · Já dirigem? */}
      <Block n={next()} question="Elas já estão dirigindo de verdade?"
        answer={<span><b className="text-lg text-primary">{pct(drivingNow, total)}%</b> já pegam o carro ({drivingNow} de {total} alunas).</span>}
        hint="Onde cada aluna está hoje com o volante.">
        <HBars data={toArr(summary.driving)} />
      </Block>

      {/* 4 · O que querem mais? */}
      <Block n={next()} question="O que elas mais querem ver na plataforma agora?"
        answer={wantsArr[0] ? <span>O mais pedido: <b>{wantsArr[0].name}</b>.</span> : undefined}
        hint="Seu próximo passo de produto, direto da boca da aluna.">
        <HBars data={wantsArr} />
      </Block>

      {/* 5 · O que amaram? */}
      <Block n={next()} question="O que elas mais amaram no curso?"
        answer={likedArr[0] ? <span>Ponto mais forte: <b>{likedArr[0].name}</b>.</span> : undefined}
        hint="Use isso no marketing e na página de vendas.">
        <HBars data={likedArr} />
      </Block>

      {/* 6 · Querem continuar? */}
      <Block n={next()} question="Elas querem continuar com a gente num próximo nível?"
        answer={<span><b className="text-lg text-primary">{pct(contSim, total)}%</b> disseram que sim.</span>}
        hint="Sinal de quem topa comprar um próximo módulo/turma.">
        <HBars data={toArr(summary.continue)} />
      </Block>

      {/* 7 · Depoimentos */}
      <Block n={next()} question="Quantos depoimentos posso usar na venda?"
        answer={<span><b className="text-lg text-primary">{summary.testimonials}</b> aluna(s) escreveram depoimento e autorizaram o uso.</span>}
        hint="Vê o texto de cada um lá embaixo, na lista de respostas.">
      </Block>

      {/* 8 · Temas da IA (só depois de catalogar) */}
      {themesArr.length > 0 && (
        <Block n={next()} question="Quais assuntos mais apareceram nas respostas?"
          answer={themesArr[0] ? <span>Mais falado: <b>{themesArr[0].name}</b>.</span> : undefined}
          hint="Temas que a IA agrupou a partir das respostas abertas.">
          <HBars data={themesArr} />
        </Block>
      )}

      {/* Respostas, uma por uma */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-base font-black text-foreground mb-3">Respostas, uma por uma</h3>
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
      </div>
    </div>
  );
}
