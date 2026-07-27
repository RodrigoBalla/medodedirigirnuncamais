import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { getLessonQuiz, submitQuiz, type QuizQuestion, type QuizResult } from "@/lib/provas";

// ─── LessonQuiz ───────────────────────────────────────────────────────────────
// Prova de reforço (3 perguntas MC, UMA por vez) que aparece ao concluir uma
// aula e BLOQUEIA a próxima até ser respondida. Correção no servidor. Ao final,
// tela comemorativa (parabéns + nome + confetes + frase de aprendizado).
// =============================================================================

const LEARNING_PHRASES = [
  "Cada aula que você conclui te deixa mais perto de dirigir com liberdade. 🚗",
  "Aprender é assim: um passo de cada vez, no seu tempo. Você está indo muito bem! 💛",
  "O que você fixou hoje, ninguém tira de você. Confiança se constrói praticando. ✨",
  "Devagar e sempre — é assim que o medo vai embora. Que orgulho de você! 🌟",
  "Conhecimento vira segurança, e segurança vira liberdade ao volante. 🙌",
];

export function LessonQuiz({
  lessonId,
  lessonTitle,
  studentName,
  onDone,
}: {
  lessonId: string;
  lessonTitle: string;
  studentName?: string;
  onDone: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [phrase] = useState(() => LEARNING_PHRASES[Math.floor(Math.random() * LEARNING_PHRASES.length)]);

  useEffect(() => {
    getLessonQuiz(lessonId)
      .then((qs) => {
        if (!qs.length) { onDone(); return; }
        setQuestions(qs);
      })
      .catch(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // confetes ao chegar na tela de parabéns
  useEffect(() => {
    if (!result) return;
    const colors = ["#FFD60A", "#25D366", "#ffffff", "#4ade80"];
    confetti({ particleCount: 130, spread: 90, origin: { y: 0.25 }, colors });
    const t1 = setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 90, origin: { x: 0, y: 0.2 }, colors, gravity: 1.3 }), 300);
    const t2 = setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 90, origin: { x: 1, y: 0.2 }, colors, gravity: 1.3 }), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [result]);

  if (!questions) {
    return (
      <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const total = questions.length;
  const q = questions[step];
  const selected = answers[q.id];
  const canAdvance = selected !== undefined;

  async function next() {
    if (selected === undefined) return;
    if (step < total - 1) { setStep((s) => s + 1); return; }
    // última → envia
    setSubmitting(true);
    try {
      const r = await submitQuiz(lessonId, answers);
      setResult(r);
    } catch {
      toast.error("Não consegui enviar a prova. Tenta de novo?");
      setSubmitting(false);
    }
  }

  // ── Tela de PARABÉNS ──
  if (result) {
    const nome = (studentName || "").trim();
    return (
      <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm bg-card border border-primary/20 rounded-3xl shadow-2xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            className="mx-auto size-24 rounded-full bg-[hsl(var(--success)/0.15)] flex items-center justify-center mb-5"
          >
            <span className="material-symbols-outlined text-6xl text-[hsl(var(--success))] filled-icon">workspace_premium</span>
          </motion.div>

          <h2 className="text-2xl font-black text-foreground mb-1 text-balance">
            Parabéns{nome ? `, ${nome}` : ""}! 🎉
          </h2>
          <p className="text-lg font-black text-primary mb-4">Muito bem!</p>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 mb-4">
            <span className="material-symbols-outlined text-primary text-base">check_circle</span>
            <span className="text-sm font-bold text-foreground tabular-nums">
              Você acertou {result.correct} de {result.total}
            </span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6 text-balance">{phrase}</p>

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

  // ── Pergunta (uma por vez) ──
  return (
    <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-card border border-primary/20 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary filled-icon">quiz</span>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">Prova de reforço</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Só pra fixar o que você viu em <b className="text-foreground">{lessonTitle.replace(/^Aula \d+ — /, "")}</b>.
            Responda as {total} pra liberar a próxima aula. 😉
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{step + 1}/{total}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="px-6 py-5"
          >
            <h2 className="text-lg font-black text-foreground mb-4 text-balance">{q.question}</h2>
            <div className="flex flex-col gap-2.5">
              {q.options.map((opt, oi) => {
                const active = selected === oi;
                return (
                  <button
                    key={oi}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className={`text-left px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:border-primary/40 hover:bg-accent/40 text-foreground/90"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`size-4 rounded-full border-2 shrink-0 ${active ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm font-bold text-muted-foreground disabled:opacity-0 hover:text-foreground transition-colors px-2"
          >
            ← Voltar
          </button>
          <button
            onClick={next}
            disabled={!canAdvance || submitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs px-7 py-3.5 rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {submitting ? (
              <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : step < total - 1 ? (
              "Continuar"
            ) : (
              "Enviar prova"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
