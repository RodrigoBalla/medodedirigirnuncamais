import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { getLessonQuiz, submitQuiz, type QuizQuestion, type QuizResult } from "@/lib/provas";

// ─── LessonQuiz ───────────────────────────────────────────────────────────────
// Prova de reforço (3 perguntas MC) que aparece ao concluir uma aula e BLOQUEIA
// a próxima até ser respondida. Correção é no servidor (submit_quiz). Mostra a
// nota da prova e uma mensagem de incentivo. onDone() libera o avanço.
// =============================================================================

export function LessonQuiz({
  lessonId,
  lessonTitle,
  onDone,
}: {
  lessonId: string;
  lessonTitle: string;
  onDone: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    getLessonQuiz(lessonId)
      .then((qs) => {
        if (!qs.length) {
          onDone(); // sem prova cadastrada → libera
          return;
        }
        setQuestions(qs);
      })
      .catch(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  if (!questions) {
    return (
      <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  async function send() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    try {
      const r = await submitQuiz(lessonId, answers);
      setResult(r);
      if (r.correct === r.total) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ["#FFD60A", "#25D366", "#fff"] });
      }
    } catch {
      toast.error("Não consegui enviar a prova. Tenta de novo?");
      setSubmitting(false);
    }
  }

  // ── Tela de resultado ──
  if (result) {
    const pct = Math.round((result.correct / result.total) * 100);
    const great = pct >= 67;
    return (
      <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-card border border-primary/20 rounded-3xl shadow-2xl p-7 text-center"
        >
          <div
            className={`mx-auto size-20 rounded-full flex items-center justify-center mb-4 ${
              great ? "bg-[hsl(var(--success)/0.15)]" : "bg-primary/10"
            }`}
          >
            <span
              className={`material-symbols-outlined text-5xl filled-icon ${
                great ? "text-[hsl(var(--success))]" : "text-primary"
              }`}
            >
              {great ? "workspace_premium" : "psychology_alt"}
            </span>
          </div>
          <p className="text-3xl font-black tabular-nums mb-1">
            {result.correct}<span className="text-muted-foreground text-xl">/{result.total}</span>
          </p>
          <p className="text-sm font-bold text-muted-foreground mb-4">
            {great ? "Mandou muito bem! 👏" : "Boa! Todo passo conta 💛"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            {great
              ? "Você fixou bem essa aula. Bora pra próxima!"
              : "O que importa é seguir praticando com calma. Você já pode avançar."}
          </p>
          <button
            onClick={onDone}
            className="w-full bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-3.5 rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Continuar →
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Perguntas ──
  return (
    <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg my-8 bg-card border border-primary/20 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary filled-icon">quiz</span>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">
              Prova de reforço
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Só pra fixar o que você viu em <b className="text-foreground">{lessonTitle.replace(/^Aula \d+ — /, "")}</b>.
            Responda as 3 pra liberar a próxima aula. 😉
          </p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {questions.map((q, qi) => (
            <div key={q.id}>
              <p className="text-sm font-black text-foreground mb-3 flex gap-2">
                <span className="text-primary">{qi + 1}.</span>
                <span className="text-balance">{q.question}</span>
              </p>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const active = answers[q.id] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background hover:border-primary/40 hover:bg-accent/40 text-foreground/90"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`size-4 rounded-full border-2 shrink-0 ${
                            active ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}
                        />
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 pt-1">
          <button
            onClick={send}
            disabled={!allAnswered || submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-3.5 rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {submitting ? (
              <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              "Enviar prova"
            )}
          </button>
          {!allAnswered && (
            <p className="text-center text-[11px] text-muted-foreground mt-2">Responda as 3 perguntas 🙂</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
