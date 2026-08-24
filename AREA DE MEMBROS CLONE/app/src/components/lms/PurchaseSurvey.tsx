import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { getPurchaseSurvey, submitPurchaseSurvey, type SurveyQuestion } from "@/lib/provas";

// ─── PurchaseSurvey ───────────────────────────────────────────────────────────
// Pesquisa "Por que você comprou?" — aparece 1x, após a Aula 00, e BLOQUEIA o
// acesso às próximas aulas até ser respondida. Wizard de perguntas de múltipla
// escolha (uma por vez, leitura fácil). Ao terminar, chama onDone().
// =============================================================================

const OTHER = "__outro__";

export function PurchaseSurvey({ onDone }: { onDone: () => void }) {
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null); // qual opção "outro" está aberta
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPurchaseSurvey()
      .then((qs) => setQuestions(qs))
      .catch(() => {
        // Se falhar ao carregar, não trava a aluna: libera.
        onDone();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const isOtherOpen = picking === q.id;

  function choose(qid: string, value: string) {
    setAnswers((a) => ({ ...a, [qid]: value }));
    setPicking(null);
  }

  async function next() {
    // valida "outro"
    let value = answers[q.id];
    if (value === OTHER) {
      const t = (otherText[q.id] || "").trim();
      if (!t) return;
      value = t;
    }
    if (!value) return;
    const merged = { ...answers, [q.id]: value };
    setAnswers(merged);

    if (step < total - 1) {
      setStep((s) => s + 1);
      return;
    }
    // último → envia
    setSubmitting(true);
    try {
      await submitPurchaseSurvey(merged);
      toast.success("Obrigada por compartilhar! 💛", { description: "Agora é com você — bons estudos!" });
      onDone();
    } catch {
      toast.error("Não consegui salvar. Tenta de novo?");
      setSubmitting(false);
    }
  }

  const canAdvance =
    selected === OTHER ? (otherText[q.id] || "").trim().length > 0 : !!selected;

  return (
    <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-card border border-primary/20 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* topo */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary filled-icon">favorite</span>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">
              Antes de começar
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Me conta um pouquinho sobre você — assim eu preparo a melhor jornada pra te ajudar
            a vencer o medo. É rapidinho! 💛
          </p>
          {/* progresso */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / total) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
              {step + 1}/{total}
            </span>
          </div>
        </div>

        {/* pergunta */}
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
              {q.options.map((opt) => {
                const active = selected === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => choose(q.id, opt)}
                    className={`text-left px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
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
              {q.allow_other && (
                <div>
                  <button
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [q.id]: OTHER }));
                      setPicking(q.id);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                      selected === OTHER
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:border-primary/40 hover:bg-accent/40 text-foreground/90"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`size-4 rounded-full border-2 shrink-0 ${
                          selected === OTHER ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                      />
                      Outro
                    </span>
                  </button>
                  {isOtherOpen && (
                    <input
                      autoFocus
                      value={otherText[q.id] || ""}
                      onChange={(e) => setOtherText((o) => ({ ...o, [q.id]: e.target.value }))}
                      placeholder="Escreve aqui..."
                      className="mt-2 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* rodapé */}
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
              "Concluir 💛"
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
