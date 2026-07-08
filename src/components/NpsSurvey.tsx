import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useNpsSurvey, type LockedModule } from "@/hooks/useNpsSurvey";
import { NPS_QUESTIONS, NPS_WHATSAPP, type NpsQuestion } from "@/lib/nps";
import { CheckoutModal } from "@/components/lms/CheckoutModal";
import { useDisplayName } from "@/hooks/useDisplayName";

// ─── NpsSurvey ───────────────────────────────────────────────────────────────
// Pesquisa NPS gamificada: a aluna responde num wizard, moedas "voam" e o
// contador sobe a cada resposta; no fim, animação do saldo caindo na carteira
// (R$10 = 1000 moedas, creditado no servidor). Depois: usar o saldo pra comprar
// um módulo que ela não tem (checkout + desconto via WhatsApp) ou deixar na
// carteira. Montado só pra alunas no AppLayout. Aparece 1x (controle server-side).
// =============================================================================

type Phase = "intro" | "quiz" | "reward" | "modules";

const brl = (coins: number) => (coins / 100).toFixed(2).replace(".", ",");
const firstName = (n: string) => (n || "aluna").trim().split(/\s+/)[0] || "aluna";

export function NpsSurvey() {
  const { status, lockedModules, submit } = useNpsSurvey();
  const displayName = useDisplayName("");

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [coins, setCoins] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pickedModule, setPickedModule] = useState<LockedModule | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const awarded = useRef<Set<number>>(new Set());

  const total = NPS_QUESTIONS.length;
  const rewardCoins = status?.rewardCoins ?? 1000;
  const coinsPerStep = Math.max(1, Math.round(rewardCoins / total));

  // Abre 1.2s depois que o status confirma (deixa o app renderizar primeiro)
  useEffect(() => {
    if (status?.shouldShow && !dismissed) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [status, dismissed]);

  if (!open || !status?.shouldShow) return null;

  const q = NPS_QUESTIONS[step];

  function setAnswer(id: string, value: any) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function awardCoins() {
    if (awarded.current.has(step)) return;
    awarded.current.add(step);
    setCoins((c) => Math.min(rewardCoins, c + coinsPerStep));
    setBurstKey((k) => k + 1);
  }

  function goNext() {
    awardCoins();
    if (step < total - 1) setStep((s) => s + 1);
    else finish();
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function finish() {
    if (submitting) return;
    setSubmitting(true);
    const res = await submit(answers);
    setSubmitting(false);
    setCoins(rewardCoins);
    setBalance(res?.balance ?? rewardCoins);
    setPhase("reward");
    const colors = ["#FFD60A", "#FFC700", "#FFAA00", "#FFFFFF"];
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 }, colors, zIndex: 10002 });
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0.1, y: 0.7 }, colors, zIndex: 10002 }), 250);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 0.9, y: 0.7 }, colors, zIndex: 10002 }), 400);
  }

  function closeAll() {
    setOpen(false);
    setDismissed(true);
  }

  // Só a nota é obrigatória; o resto flui livre (maximiza conclusão).
  const canAdvance = q.type === "nps" ? answers.nps_score != null : true;

  // WhatsApp pré-pronto pra pedir o desconto de R$10
  function waUrl(mod: LockedModule): string {
    const nome = firstName(displayName);
    const txt =
      `Oi Carla! Sou *${nome}*, do app Medo de Dirigir Nunca Mais.\n\n` +
      `Respondi a pesquisa e ganhei *R$ 10 em moedas* 🪙.\n` +
      `Quero usar pra comprar o *${mod.title}*. Como aplico o desconto? 💛`;
    return `https://wa.me/${NPS_WHATSAPP}?text=${encodeURIComponent(txt)}`;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <div className="absolute inset-0 bg-[#060f20]/90 backdrop-blur-md" aria-hidden />

          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative z-10 w-full max-w-lg bg-card border-2 border-primary/30 md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="caution-tape h-2 shrink-0" aria-hidden />

            {/* ─── Header: contador de moedas ─── */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border relative">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary filled-icon">savings</span>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Pesquisa · ganhe R$ {brl(rewardCoins)}
                </span>
              </div>
              <div className="relative flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5">
                <span className="text-base">🪙</span>
                <motion.span key={coins} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-sm font-black text-primary tabular-nums">
                  {coins}
                </motion.span>
                {/* moedas voando ao ganhar */}
                <AnimatePresence>
                  {burstKey > 0 && (
                    <motion.div key={burstKey} className="pointer-events-none absolute -top-1 right-2">
                      {[0, 1, 2, 3].map((i) => (
                        <motion.span
                          key={i}
                          initial={{ y: 0, x: 0, opacity: 1, scale: 0.6 }}
                          animate={{ y: -34 - i * 6, x: (i - 1.5) * 12, opacity: 0, scale: 1.1 }}
                          transition={{ duration: 0.7, delay: i * 0.04, ease: "easeOut" }}
                          className="absolute text-sm"
                        >
                          🪙
                        </motion.span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {(phase === "intro" || phase === "quiz") && (
                <button
                  onClick={closeAll}
                  className="absolute -bottom-0 right-0 hidden"
                  aria-hidden
                />
              )}
            </div>

            {/* Progresso (só no quiz) */}
            {phase === "quiz" && (
              <div className="shrink-0 h-1 bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${((step + 1) / total) * 100}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* ══════════════ INTRO ══════════════ */}
              {phase === "intro" && (
                <div className="p-6 md:p-8 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    className="mx-auto mb-5 size-20 rounded-3xl bg-gradient-to-br from-primary to-yellow-500 flex items-center justify-center text-4xl shadow-lg shadow-primary/30"
                  >
                    💛
                  </motion.div>
                  <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight mb-2" style={{ textWrap: "balance" }}>
                    Me conta como foi sua jornada?
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-2" style={{ textWrap: "balance" }}>
                    São {total} perguntinhas rápidas ({total <= 10 ? "menos de 2 minutos" : "poucos minutos"}). A cada resposta você ganha moedas.
                  </p>
                  <p className="text-base font-black text-primary mb-6">
                    No final: <span className="underline decoration-primary/40">R$ {brl(rewardCoins)} em moedas</span> na sua carteira 🪙
                  </p>
                  <button
                    onClick={() => setPhase("quiz")}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform"
                  >
                    Bora começar 🚗
                  </button>
                  <button
                    onClick={closeAll}
                    className="w-full py-3 mt-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Agora não
                  </button>
                </div>
              )}

              {/* ══════════════ QUIZ ══════════════ */}
              {phase === "quiz" && q && (
                <div className="p-6 md:p-7">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-2">
                    Pergunta {step + 1} de {total}
                  </p>
                  <h3 className="text-lg md:text-xl font-black text-foreground leading-snug mb-1" style={{ textWrap: "balance" }}>
                    {q.title}
                  </h3>
                  {q.subtitle && <p className="text-xs text-muted-foreground mb-4">{q.subtitle}</p>}
                  {!q.subtitle && <div className="mb-4" />}

                  <QuestionBody
                    q={q}
                    value={answers[q.id]}
                    consent={answers.testimonial_consent}
                    onChange={(v) => setAnswer(q.id, v)}
                    onConsent={(c) => setAnswer("testimonial_consent", c)}
                    onPick={() => setTimeout(goNext, 380)}
                  />
                </div>
              )}

              {/* ══════════════ REWARD + ESCOLHA ══════════════ */}
              {phase === "reward" && (
                <div className="p-6 md:p-8 text-center">
                  <motion.p
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-2"
                  >
                    Recompensa liberada 🎉
                  </motion.p>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 180, damping: 14 }}
                    className="my-4"
                  >
                    <p className="text-sm text-muted-foreground mb-1">Você ganhou</p>
                    <p className="text-5xl md:text-6xl font-black text-primary" style={{ textShadow: "0 0 30px rgba(255,214,10,0.5)" }}>
                      R$ {brl(rewardCoins)}
                    </p>
                    <p className="text-sm font-bold text-foreground mt-1">em moedas 🪙</p>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xs text-muted-foreground mb-6"
                  >
                    Já caiu na sua carteira. Saldo atual: <span className="font-black text-foreground">R$ {brl(balance)}</span>
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col gap-2"
                  >
                    <button
                      onClick={() => setPhase("modules")}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined text-base">shopping_bag</span>
                      Usar agora num módulo novo
                    </button>
                    <button
                      onClick={() => {
                        closeAll();
                        toast.success(`R$ ${brl(rewardCoins)} na sua carteira! 🪙`, {
                          description: "Use quando quiser, na aba de moedas.",
                          duration: 5000,
                        });
                      }}
                      className="w-full py-3 rounded-2xl border border-border bg-background text-foreground font-bold text-sm hover:bg-accent transition-colors"
                    >
                      Deixar na carteira
                    </button>
                  </motion.div>
                </div>
              )}

              {/* ══════════════ MÓDULOS ══════════════ */}
              {phase === "modules" && (
                <div className="p-6 md:p-7">
                  {lockedModules.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-3">🏆</div>
                      <h3 className="font-black text-lg mb-1">Você já tem todos os cursos!</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Seu R$ {brl(rewardCoins)} fica guardado na carteira pra quando lançarmos algo novo.
                      </p>
                      <button onClick={closeAll} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide">
                        Fechar
                      </button>
                    </div>
                  ) : !pickedModule ? (
                    <>
                      <h3 className="font-black text-lg text-foreground mb-1">Escolha um módulo pra desbloquear</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Use seu saldo de R$ {brl(rewardCoins)} como desconto 💛
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {lockedModules.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setPickedModule(m)}
                            className="group text-left rounded-2xl border border-border bg-background overflow-hidden hover:border-primary/60 transition-colors"
                          >
                            <div className="aspect-[9/16] bg-gradient-to-br from-primary/20 to-primary/5 relative">
                              {m.image_url ? (
                                <img src={m.image_url} alt={m.title} className="w-full h-full object-cover" draggable={false} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl">🚗</div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-bold text-foreground line-clamp-2 leading-tight">{m.title}</p>
                              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
                                Desbloquear <span className="material-symbols-outlined text-xs">arrow_forward</span>
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button onClick={closeAll} className="w-full py-3 mt-4 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                        Deixar o saldo na carteira
                      </button>
                    </>
                  ) : (
                    // Confirmação + desconto via WhatsApp antes do checkout
                    <div className="text-center py-2">
                      <div className="mx-auto mb-4 w-28 aspect-[9/16] rounded-xl overflow-hidden border-2 border-primary/40 shadow-lg">
                        {pickedModule.image_url ? (
                          <img src={pickedModule.image_url} alt={pickedModule.title} className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl bg-primary/10">🚗</div>
                        )}
                      </div>
                      <h3 className="font-black text-lg text-foreground mb-1 leading-tight" style={{ textWrap: "balance" }}>
                        {pickedModule.title}
                      </h3>
                      <div className="flex items-start gap-2 text-left text-[12px] text-primary bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5 my-4">
                        <span className="material-symbols-outlined text-base mt-0.5">savings</span>
                        <span>
                          Você tem <strong>R$ {brl(rewardCoins)}</strong> de saldo. Fale com a Carla no WhatsApp
                          <strong> antes de pagar</strong> pra ela aplicar seu desconto no checkout. 💛
                        </span>
                      </div>
                      <a
                        href={waUrl(pickedModule)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black px-4 py-3.5 rounded-2xl shadow-lg shadow-[#25D366]/30 uppercase tracking-wide text-xs transition-all mb-2"
                      >
                        <span className="material-symbols-outlined text-base">chat</span>
                        Pegar meu desconto no WhatsApp
                      </a>
                      <button
                        onClick={() => setCheckoutOpen(true)}
                        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">lock_open</span>
                        Ir pro checkout
                      </button>
                      <button
                        onClick={() => setPickedModule(null)}
                        className="w-full py-3 mt-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Voltar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer do quiz (voltar / próxima) */}
            {phase === "quiz" && (
              <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-border">
                <button
                  onClick={goBack}
                  disabled={step === 0}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={goNext}
                  disabled={!canAdvance || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : step === total - 1 ? (
                    <>Finalizar e resgatar 🪙</>
                  ) : q.optional && answers[q.id] == null ? (
                    <>Pular</>
                  ) : (
                    <>Próxima</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Checkout do módulo escolhido */}
      {checkoutOpen && pickedModule?.checkout_slug && (
        <CheckoutModal
          open={checkoutOpen}
          onClose={() => {
            setCheckoutOpen(false);
            closeAll();
            toast.success("Quase lá! 🎉", {
              description: "Assim que sua compra confirmar, o novo módulo aparece na sua área.",
              duration: 6000,
            });
          }}
          contentId={pickedModule.checkout_slug}
          title={pickedModule.title}
        />
      )}
    </>
  );
}

// ─── Corpo da pergunta (por tipo) ────────────────────────────────────────────
function QuestionBody({
  q,
  value,
  consent,
  onChange,
  onConsent,
  onPick,
}: {
  q: NpsQuestion;
  value: any;
  consent: boolean | undefined;
  onChange: (v: any) => void;
  onConsent: (c: boolean) => void;
  onPick: () => void;
}) {
  if (q.type === "nps") {
    return (
      <div>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              onClick={() => { onChange(n); onPick(); }}
              className={`aspect-square rounded-xl text-sm font-black transition-all ${
                value === n
                  ? "bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/30"
                  : "bg-background border border-border text-foreground hover:border-primary/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium">
          <span>Não recomendaria</span>
          <span>Recomendaria demais</span>
        </div>
      </div>
    );
  }

  if (q.type === "scale5") {
    return (
      <div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => { onChange(n); onPick(); }}
              className={`py-4 rounded-xl text-lg font-black transition-all ${
                value === n
                  ? "bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/30"
                  : "bg-background border border-border text-foreground hover:border-primary/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium">
          <span>{q.lowLabel}</span>
          <span>{q.highLabel}</span>
        </div>
      </div>
    );
  }

  if (q.type === "single") {
    return (
      <div className="flex flex-col gap-2">
        {q.options!.map((o) => (
          <button
            key={o.v}
            onClick={() => { onChange(o.v); onPick(); }}
            className={`text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${
              value === o.v
                ? "bg-primary/15 border-primary text-foreground"
                : "bg-background border-border text-foreground hover:border-primary/50"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "multi") {
    const arr: string[] = Array.isArray(value) ? value : [];
    const max = q.maxSelect ?? 99;
    const toggle = (v: string) => {
      if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
      else if (arr.length < max) onChange([...arr, v]);
    };
    return (
      <div className="flex flex-col gap-2">
        {q.options!.map((o) => {
          const on = arr.includes(o.v);
          return (
            <button
              key={o.v}
              onClick={() => toggle(o.v)}
              className={`flex items-center gap-3 text-left px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                on ? "bg-primary/15 border-primary text-foreground" : "bg-background border-border text-foreground hover:border-primary/50"
              }`}
            >
              <span className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                {on && <span className="material-symbols-outlined text-primary-foreground text-sm">check</span>}
              </span>
              {o.l}
            </button>
          );
        })}
      </div>
    );
  }

  // text + testimonial
  return (
    <div>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={q.type === "testimonial" ? 4 : 3}
        placeholder="Escreva aqui…"
        className="w-full px-3.5 py-3 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
      />
      {q.type === "testimonial" && q.consentLabel && (
        <button
          onClick={() => onConsent(!consent)}
          className="flex items-start gap-2.5 mt-3 text-left w-full"
        >
          <span className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${consent ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
            {consent && <span className="material-symbols-outlined text-primary-foreground text-sm">check</span>}
          </span>
          <span className="text-xs text-muted-foreground leading-relaxed">{q.consentLabel}</span>
        </button>
      )}
    </div>
  );
}
