import { useEffect, useState } from "react";
import {
  adminAproveitamento, adminPurchaseSurveySummary, adminStudentQuizDetail,
  type AproveitamentoData, type SurveySummary, type StudentQuizDetail,
} from "@/lib/provas";

// ─── AproveitamentoTab ────────────────────────────────────────────────────────
// Painel admin: notas de aproveitamento das provas por aluna (+ detalhe) e os
// resultados da pesquisa "por que você comprou?" (motivos agregados).
// =============================================================================

type View = "notas" | "pesquisa";

const scoreColor = (s: number | null) =>
  s == null ? "text-muted-foreground"
  : s >= 70 ? "text-[hsl(var(--success))]"
  : s >= 40 ? "text-amber-500"
  : "text-destructive";

export function AproveitamentoTab() {
  const [view, setView] = useState<View>("notas");
  const [apro, setApro] = useState<AproveitamentoData | null>(null);
  const [survey, setSurvey] = useState<SurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<{ name: string; rows: StudentQuizDetail[] } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, s] = await Promise.all([adminAproveitamento(), adminPurchaseSurveySummary()]);
        setApro(a);
        setSurvey(s);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openDetail(userId: string, name: string) {
    try {
      const rows = await adminStudentQuizDetail(userId);
      setDetailFor({ name, rows });
    } catch { /* ignore */ }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }
  if (err) {
    return <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">Erro: {err}</div>;
  }

  const students = apro?.students ?? [];
  const avg = students.length
    ? Math.round(students.reduce((s, x) => s + (x.score ?? 0), 0) / students.filter((x) => x.score != null).length || 0)
    : null;

  return (
    <div className="space-y-5">
      {/* header + toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">school</span>
          Aproveitamento das alunas
        </h2>
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-bold">
          <button onClick={() => setView("notas")} className={`px-4 py-2 ${view === "notas" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>Notas das provas</button>
          <button onClick={() => setView("pesquisa")} className={`px-4 py-2 ${view === "pesquisa" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>Motivos da compra</button>
        </div>
      </div>

      {view === "notas" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Alunas com prova" value={String(students.length)} />
            <Kpi label="Nota média" value={avg != null ? `${avg}%` : "—"} accent />
            <Kpi label="Aulas com prova" value={String(apro?.lessons_with_quiz ?? 0)} />
            <Kpi label="Total de perguntas" value={String(apro?.total_questions ?? 0)} />
          </div>

          {students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma aluna fez prova ainda. 📚
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="text-left px-3 py-2 font-bold">Aluna</th>
                    <th className="text-right px-3 py-2 font-bold">Nota</th>
                    <th className="text-right px-3 py-2 font-bold hidden sm:table-cell">Provas feitas</th>
                    <th className="text-right px-3 py-2 font-bold hidden md:table-cell">Acertos</th>
                    <th className="text-right px-3 py-2 font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.user_id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-3 py-2">
                        <div className="font-bold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </td>
                      <td className={`px-3 py-2 text-right font-black tabular-nums ${scoreColor(s.score)}`}>{s.score != null ? `${s.score}%` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{s.quizzes_done}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">{s.total_correct}/{s.total_questions}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openDetail(s.user_id, s.name)} className="text-primary text-xs font-bold hover:underline">ver provas</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === "pesquisa" && survey && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">{survey.total_responses}</b> aluna{survey.total_responses === 1 ? "" : "s"} responderam à pesquisa de compra.
          </p>
          {survey.total_responses === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Ninguém respondeu a pesquisa ainda. 💛
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {survey.questions.map((q) => {
                // conta respostas por opção
                const counts: Record<string, number> = {};
                survey.responses.forEach((r) => {
                  const a = r.answers?.[q.id];
                  if (a) counts[a] = (counts[a] || 0) + 1;
                });
                const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                const max = entries[0]?.[1] || 1;
                return (
                  <div key={q.id} className="rounded-xl border border-border p-4">
                    <p className="text-sm font-bold mb-3">{q.question}</p>
                    <div className="space-y-2">
                      {entries.map(([opt, n]) => (
                        <div key={opt}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-foreground/90">{opt}</span>
                            <span className="font-bold tabular-nums text-muted-foreground">{n}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(n / max) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      {entries.length === 0 && <p className="text-xs text-muted-foreground">Sem respostas.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* modal detalhe de provas de uma aluna */}
      {detailFor && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailFor(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold">Provas de {detailFor.name}</h3>
              <button onClick={() => setDetailFor(null)} className="material-symbols-outlined text-muted-foreground hover:text-foreground">close</button>
            </div>
            {detailFor.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não fez nenhuma prova.</p>
            ) : (
              <div className="space-y-2">
                {detailFor.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="font-semibold">{r.lesson}</span>
                    <span className={`font-black tabular-nums ${r.correct === r.total ? "text-[hsl(var(--success))]" : "text-foreground"}`}>{r.correct}/{r.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
