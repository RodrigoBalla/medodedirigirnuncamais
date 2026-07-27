import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { getLessonQuiz, submitQuiz, type QuizQuestion, type QuizResult } from "@/lib/provas";
import { primeSound, playWin, playPerfect, playAlmost, playCoins, playTick } from "@/lib/sfx";

// ─── LessonQuiz ───────────────────────────────────────────────────────────────
// Prova de reforço (3 perguntas MC, UMA por vez) que aparece ao concluir uma
// aula e BLOQUEIA a próxima até ser respondida. Correção no servidor.
// Tela final GAMIFICADA (dopamina):
//   • 0 acertos  → "QUASE LÁ..." + só XP (som suave, sem confete)
//   • 1–2 acertos→ Parabéns + XP + moedas (confete + som de vitória)
//   • gabaritou  → "GABARITOU!" + XP + moedas com bônus (confete forte + fanfarra)
// As moedas só entram no cofrinho quando a aluna clica em "Resgatar" (moedas voam,
// saldo sobe, som de moedinha). Recompensa só na 1ª vez (backend controla).
// =============================================================================

const WIN_PHRASES = [
  "Cada aula que você conclui te deixa mais perto de dirigir com liberdade. 🚗",
  "O que você fixou hoje, ninguém tira de você. Confiança se constrói praticando. ✨",
  "Devagar e sempre — é assim que o medo vai embora. Que orgulho de você! 🌟",
  "Conhecimento vira segurança, e segurança vira liberdade ao volante. 🙌",
];
const ALMOST_PHRASES = [
  "Revisa a aula com calma e tenta de novo — você vai pegar rapidinho. 💛",
  "Aprender é assim: um passo de cada vez, no seu tempo. Segue firme! 💪",
  "Ninguém acerta tudo de primeira. O importante é não parar. Bora! 🚗",
];

function pick(arr: string[], seed: number) {
  return arr[seed % arr.length];
}

// Conta de `from` até `to` com easing (sensação de placar subindo).
function CountUp({ from = 0, to, duration = 850, className }: { from?: number; to: number; duration?: number; className?: string }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setV(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration]);
  return <span className={className}>{v}</span>;
}

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
  const [claimed, setClaimed] = useState(false);
  const [seed] = useState(() => (studentName ? studentName.length : 0) + Math.floor((lessonTitle || "").length));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    getLessonQuiz(lessonId)
      .then((qs) => {
        if (!qs.length) { onDone(); return; }
        setQuestions(qs);
      })
      .catch(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // Efeitos ao chegar no resultado: som + confete (confete num canvas LOCAL,
  // dentro do overlay, pra ficar NA FRENTE do fundo opaco — o bug do print).
  useEffect(() => {
    if (!result) return;
    const perfect = result.correct === result.total;
    if (result.correct === 0) {
      playAlmost();
      return;
    }
    if (perfect) playPerfect(); else playWin();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const fire = confetti.create(canvas, { resize: true, useWorker: true });
    const colors = ["#FFD60A", "#25D366", "#ffffff", "#4ade80"];
    fire({ particleCount: perfect ? 190 : 110, spread: perfect ? 115 : 80, startVelocity: 48, origin: { y: 0.35 }, colors });
    const t1 = setTimeout(() => fire({ particleCount: 80, angle: 60, spread: 80, origin: { x: 0, y: 0.45 }, colors }), 250);
    const t2 = setTimeout(() => fire({ particleCount: 80, angle: 120, spread: 80, origin: { x: 1, y: 0.45 }, colors }), 450);
    const t3 = perfect ? setTimeout(() => fire({ particleCount: 120, spread: 120, startVelocity: 40, origin: { y: 0.4 }, colors }), 700) : undefined;
    return () => { clearTimeout(t1); clearTimeout(t2); if (t3) clearTimeout(t3); fire.reset(); };
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
    primeSound();
    if (selected === undefined) return;
    if (step < total - 1) { playTick(); setStep((s) => s + 1); return; }
    setSubmitting(true);
    try {
      const r = await submitQuiz(lessonId, answers);
      setResult(r);
    } catch {
      toast.error("Não consegui enviar a prova. Tenta de novo?");
      setSubmitting(false);
    }
  }

  // ══════════════ TELA DE RESULTADO ══════════════
  if (result) {
    const nome = (studentName || "").trim();
    const perfect = result.correct === result.total;
    const zero = result.correct === 0;
    const coins = result.coins_awarded;
    const xp = result.xp_awarded;
    const oldBalance = Math.max(0, result.new_balance - coins);

    function claim() {
      playCoins();
      setClaimed(true);
    }

    return (
      <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-4 overflow-hidden">
        {/* confete NA FRENTE (canvas local dentro do stacking context do overlay) */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-sm bg-card border border-primary/20 rounded-3xl shadow-2xl p-7 text-center overflow-hidden"
        >
          {/* brilho de fundo */}
          <div className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-56 rounded-full blur-3xl ${zero ? "bg-primary/10" : "bg-[hsl(var(--success)/0.18)]"}`} />

          {/* ícone */}
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 11, delay: 0.1 }}
            className={`relative mx-auto size-24 rounded-full flex items-center justify-center mb-4 ${zero ? "bg-primary/15" : "bg-[hsl(var(--success)/0.15)]"}`}
          >
            {zero ? (
              // emoji (à prova de falha) — o Material Symbol "volunteering" não vinha na fonte
              <span className="text-5xl leading-none" role="img" aria-label="Força">💪</span>
            ) : (
              <span className="material-symbols-outlined text-6xl filled-icon text-[hsl(var(--success))]">
                {perfect ? "emoji_events" : "workspace_premium"}
              </span>
            )}
          </motion.div>

          {/* título */}
          <h2 className="relative text-2xl font-black text-foreground mb-1 text-balance leading-tight">
            {zero ? "Quase lá..." : perfect ? "GABARITOU! 🏆" : `Parabéns${nome ? `, ${nome}` : ""}! 🎉`}
          </h2>
          <p className="relative text-base font-black text-primary mb-3">
            {zero ? "Você tá quase!" : perfect ? "Você foi impecável!" : "Muito bem!"}
          </p>

          {/* placar */}
          <div className="relative inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 mb-4">
            <span className={`material-symbols-outlined text-base ${zero ? "text-muted-foreground" : "text-[hsl(var(--success))]"}`}>
              {zero ? "menu_book" : "check_circle"}
            </span>
            <span className="text-sm font-bold text-foreground tabular-nums">
              Você acertou {result.correct} de {result.total}
            </span>
          </div>

          {/* recompensas */}
          {(xp > 0 || coins > 0) && (
            <div className="relative flex items-stretch justify-center gap-2.5 mb-4">
              {/* XP */}
              <div className="flex-1 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2.5">
                <div className="flex items-center justify-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-lg filled-icon">bolt</span>
                  <span className="text-lg font-black tabular-nums">+<CountUp to={xp} /></span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">XP ganho</p>
              </div>
              {/* Moedas (só se ganhou) */}
              {coins > 0 && (
                <div className="flex-1 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1 text-amber-400">
                    <span className="material-symbols-outlined text-lg filled-icon">savings</span>
                    <span className="text-lg font-black tabular-nums">
                      {claimed ? <CountUp from={oldBalance} to={result.new_balance} /> : oldBalance}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                    {claimed ? "no cofrinho" : "cofrinho"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* frase */}
          <p className="relative text-sm text-muted-foreground leading-relaxed mb-5 text-balance px-1">
            {zero ? pick(ALMOST_PHRASES, seed) : pick(WIN_PHRASES, seed)}
          </p>

          {/* CTA */}
          <div className="relative">
            {coins > 0 && !claimed ? (
              <>
                {/* moedas voando pro cofrinho ao resgatar */}
                <motion.button
                  onClick={claim}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-400 text-[#3a2c00] font-black uppercase tracking-widest text-xs py-4 rounded-2xl shadow-lg shadow-amber-400/30 hover:brightness-105 transition-all"
                >
                  <span className="material-symbols-outlined text-lg filled-icon">paid</span>
                  Resgatar +{coins} moedas
                </motion.button>
                <p className="text-[11px] text-muted-foreground mt-2">Toque pra guardar no seu cofrinho 🐷</p>
              </>
            ) : (
              <button
                onClick={onDone}
                className="w-full bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-3.5 rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Continuar →
              </button>
            )}
          </div>
        </motion.div>

        {/* camada de moedas voando (aparece no resgate) */}
        <AnimatePresence>
          {claimed && coins > 0 && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              {Array.from({ length: Math.min(12, Math.max(6, Math.ceil(coins / 4))) }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 90, opacity: 0, scale: 0.4 }}
                  animate={{ x: (i - 5) * 14, y: [-40, -150, -210], opacity: [0, 1, 1, 0], scale: [0.5, 1, 0.85] }}
                  transition={{ duration: 0.8, delay: i * 0.045, ease: "easeOut" }}
                  className="absolute text-2xl"
                >
                  🪙
                </motion.span>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ══════════════ PERGUNTA (uma por vez) ══════════════
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
            Acerte pra ganhar moedas e XP! 🪙
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
                    onClick={() => { primeSound(); setAnswers((a) => ({ ...a, [q.id]: oi })); }}
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
