import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CheckoutModal } from "@/components/lms/CheckoutModal";
import {
  NPS_QUESTIONS, NPS_WHATSAPP, checkEmail, submitByEmail, lockedModulesByEmail, looksLikeEmail,
  type NpsQuestion, type LockedModuleLite,
} from "@/lib/nps";

// ─── NpsSurvey ───────────────────────────────────────────────────────────────
// Pesquisa INDEPENDENTE (sem login). A aluna informa o EMAIL da compra; a
// resposta e a recompensa (R$10 em moedas) são vinculadas à conta daquele email
// no servidor. Fluxo: email → intro → wizard (moedas voam) → saldo na carteira →
// usar saldo num módulo (checkout + desconto via WhatsApp) ou deixar na carteira.
// Renderizada na página pública /pesquisa.
// =============================================================================

type Phase = "email" | "already" | "intro" | "quiz" | "reward" | "modules";

const REWARD_TARGET = 1000; // alvo cosmético do contador (o valor real vem do servidor)
const brl = (coins: number) => (coins / 100).toFixed(2).replace(".", ",");

export function NpsSurvey({ initialEmail = "" }: { initialEmail?: string }) {
  const nav = useNavigate();

  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [checking, setChecking] = useState(false);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [coins, setCoins] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [reward, setReward] = useState(REWARD_TARGET);
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [lockedModules, setLockedModules] = useState<LockedModuleLite[]>([]);
  const [pickedModule, setPickedModule] = useState<LockedModuleLite | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const awarded = useRef<Set<number>>(new Set());
  const total = NPS_QUESTIONS.length;
  const coinsPerStep = Math.max(1, Math.round(REWARD_TARGET / total));

  async function confirmEmail(raw: string) {
    const norm = (raw || "").trim().toLowerCase();
    setEmailError("");
    if (!looksLikeEmail(norm)) { setEmailError("Digite um email válido 🙂"); return; }
    setChecking(true);
    const res = await checkEmail(norm);
    setChecking(false);
    if (!res.found) {
      setEmailError("Não achei esse email na nossa base. Use o email da sua compra.");
      return;
    }
    setEmail(norm);
    setFirstName(res.firstName || "");
    if (res.alreadyResponded) { setPhase("already"); return; }
    lockedModulesByEmail(norm).then(setLockedModules).catch(() => {});
    setPhase("intro");
  }

  const q = NPS_QUESTIONS[step];

  function setAnswer(id: string, value: any) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }
  function awardCoins() {
    if (awarded.current.has(step)) return;
    awarded.current.add(step);
    setCoins((c) => Math.min(REWARD_TARGET, c + coinsPerStep));
    setBurstKey((k) => k + 1);
  }
  function goNext() {
    awardCoins();
    if (step < total - 1) setStep((s) => s + 1);
    else finish();
  }
  function goBack() { if (step > 0) setStep((s) => s - 1); }

  async function finish() {
    if (submitting) return;
    setSubmitting(true);
    const res = await submitByEmail(email, answers);
    setSubmitting(false);
    if (!res || !res.found) {
      toast.error("Não consegui enviar", { description: "Confere o email e tenta de novo." });
      return;
    }
    if (res.alreadyResponded) { setPhase("already"); return; }
    setReward(res.reward || REWARD_TARGET);
    setBalance(res.balance || res.reward || REWARD_TARGET);
    setCoins(REWARD_TARGET);
    setPhase("reward");
    const colors = ["#FFD60A", "#FFC700", "#FFAA00", "#FFFFFF"];
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 }, colors, zIndex: 60 });
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0.1, y: 0.7 }, colors, zIndex: 60 }), 250);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 0.9, y: 0.7 }, colors, zIndex: 60 }), 400);
  }

  const canAdvance = q?.type === "nps" ? answers.nps_score != null : true;

  function waUrl(mod: LockedModuleLite): string {
    const nome = firstName || "Aluna";
    const txt =
      `Oi Carla! Sou *${nome}*, do app Medo de Dirigir Nunca Mais.\n\n` +
      `Respondi a pesquisa e ganhei *R$ 10 em moedas* 🪙.\n` +
      `Quero usar pra comprar o *${mod.title}*. Como aplico o desconto? 💛`;
    return `https://wa.me/${NPS_WHATSAPP}?text=${encodeURIComponent(txt)}`;
  }

  return (
    <>
      <div className="w-full max-w-lg">
        <div className="relative w-full bg-card border-2 border-primary/30 rounded-3xl shadow-2xl overflow-hidden">
          <div className="caution-tape h-2" aria-hidden />

          {/* Header com contador (só a partir do intro) */}
          {(phase === "intro" || phase === "quiz") && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-border relative">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary filled-icon text-base">savings</span>
                Ganhe R$ {brl(REWARD_TARGET)}
              </span>
              <div className="relative flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5">
                <span className="text-base">🪙</span>
                <motion.span key={coins} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-sm font-black text-primary tabular-nums">{coins}</motion.span>
                <AnimatePresence>
                  {burstKey > 0 && (
                    <motion.div key={burstKey} className="pointer-events-none absolute -top-1 right-2">
                      {[0, 1, 2, 3].map((i) => (
                        <motion.span key={i} initial={{ y: 0, x: 0, opacity: 1, scale: 0.6 }} animate={{ y: -34 - i * 6, x: (i - 1.5) * 12, opacity: 0, scale: 1.1 }} transition={{ duration: 0.7, delay: i * 0.04, ease: "easeOut" }} className="absolute text-sm">🪙</motion.span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {phase === "quiz" && (
            <div className="h-1 bg-muted">
              <motion.div className="h-full bg-primary" animate={{ width: `${((step + 1) / total) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
            </div>
          )}

          <div className="max-h-[76vh] overflow-y-auto">
            {/* ── EMAIL ── */}
            {phase === "email" && (
              <div className="p-6 md:p-8 text-center">
                <div className="mx-auto mb-5 size-20 rounded-3xl bg-gradient-to-br from-primary to-yellow-500 flex items-center justify-center text-4xl shadow-lg shadow-primary/30">💛</div>
                <h2 className="text-2xl font-black text-foreground leading-tight mb-2" style={{ textWrap: "balance" }}>Pesquisa rápida da sua jornada</h2>
                <p className="text-sm text-muted-foreground mb-1" style={{ textWrap: "balance" }}>São {total} perguntinhas ({"<"} 2 min) e você ganha <b className="text-primary">R$ {brl(REWARD_TARGET)} em moedas</b> 🪙.</p>
                <p className="text-xs text-muted-foreground mb-5">Digite o <b>email da sua compra</b> pra gente vincular sua resposta e sua recompensa:</p>
                <input
                  type="email"
                  inputMode="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEmail(email); }}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3.5 bg-background border border-border rounded-2xl text-sm text-center focus:outline-none focus:border-primary transition-colors mb-2"
                />
                {emailError && <p className="text-xs text-destructive mb-2">{emailError}</p>}
                <button onClick={() => confirmEmail(email)} disabled={checking} className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                  {checking ? <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Começar 🚗"}
                </button>
                <p className="text-[10px] text-muted-foreground/70 mt-3">Sua resposta é vinculada só pelo email — sem precisar logar.</p>
              </div>
            )}

            {/* ── JÁ RESPONDEU ── */}
            {phase === "already" && (
              <div className="p-6 md:p-8 text-center">
                <div className="text-6xl mb-4">💛</div>
                <h2 className="text-2xl font-black text-foreground mb-2">Você já respondeu!</h2>
                <p className="text-sm text-muted-foreground mb-6">Muito obrigada{firstName ? `, ${firstName}` : ""} — sua opinião já está com a gente. 🙏</p>
                <button onClick={() => nav("/")} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide">Ir pra área de membros</button>
                <button onClick={() => { setPhase("email"); setEmail(""); setEmailError(""); }} className="w-full py-3 mt-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Não é você? Trocar email</button>
              </div>
            )}

            {/* ── INTRO ── */}
            {phase === "intro" && (
              <div className="p-6 md:p-8 text-center">
                <div className="mx-auto mb-5 size-20 rounded-3xl bg-gradient-to-br from-primary to-yellow-500 flex items-center justify-center text-4xl shadow-lg shadow-primary/30">💛</div>
                <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight mb-2" style={{ textWrap: "balance" }}>
                  {firstName ? `Oi, ${firstName}! ` : ""}Me conta como foi sua jornada?
                </h2>
                <p className="text-sm text-muted-foreground mb-2" style={{ textWrap: "balance" }}>A cada resposta você ganha moedas. No final, <b className="text-primary">R$ {brl(REWARD_TARGET)}</b> na sua carteira 🪙.</p>
                <button onClick={() => setPhase("quiz")} className="w-full mt-4 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform">Bora começar 🚗</button>
                <button onClick={() => nav("/")} className="w-full py-3 mt-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Agora não</button>
              </div>
            )}

            {/* ── QUIZ ── */}
            {phase === "quiz" && q && (
              <div className="p-6 md:p-7">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-2">Pergunta {step + 1} de {total}</p>
                <h3 className="text-lg md:text-xl font-black text-foreground leading-snug mb-1" style={{ textWrap: "balance" }}>{q.title}</h3>
                {q.subtitle ? <p className="text-xs text-muted-foreground mb-4">{q.subtitle}</p> : <div className="mb-4" />}
                <QuestionBody q={q} value={answers[q.id]} consent={answers.testimonial_consent} onChange={(v) => setAnswer(q.id, v)} onConsent={(c) => setAnswer("testimonial_consent", c)} onPick={() => setTimeout(goNext, 380)} />
              </div>
            )}

            {/* ── REWARD ── */}
            {phase === "reward" && (
              <div className="p-6 md:p-8 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary mb-2">Recompensa liberada 🎉</p>
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} className="my-4">
                  <p className="text-sm text-muted-foreground mb-1">Você ganhou</p>
                  <p className="text-5xl md:text-6xl font-black text-primary" style={{ textShadow: "0 0 30px rgba(255,214,10,0.5)" }}>R$ {brl(reward)}</p>
                  <p className="text-sm font-bold text-foreground mt-1">em moedas 🪙</p>
                </motion.div>
                <p className="text-xs text-muted-foreground mb-6">Já caiu na sua carteira. Saldo atual: <span className="font-black text-foreground">R$ {brl(balance)}</span></p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setPhase("modules")} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-base">shopping_bag</span>Usar agora num módulo novo
                  </button>
                  <button onClick={() => { nav("/"); toast.success(`R$ ${brl(reward)} na sua carteira! 🪙`, { description: "Use quando quiser, na aba de moedas.", duration: 5000 }); }} className="w-full py-3 rounded-2xl border border-border bg-background text-foreground font-bold text-sm hover:bg-accent transition-colors">Deixar na carteira</button>
                </div>
              </div>
            )}

            {/* ── MÓDULOS ── */}
            {phase === "modules" && (
              <div className="p-6 md:p-7">
                {lockedModules.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-3">🏆</div>
                    <h3 className="font-black text-lg mb-1">Você já tem todos os cursos!</h3>
                    <p className="text-sm text-muted-foreground mb-6">Seu R$ {brl(reward)} fica guardado na carteira pra quando lançarmos algo novo.</p>
                    <button onClick={() => nav("/")} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide">Fechar</button>
                  </div>
                ) : !pickedModule ? (
                  <>
                    <h3 className="font-black text-lg text-foreground mb-1">Escolha um módulo pra desbloquear</h3>
                    <p className="text-xs text-muted-foreground mb-4">Use seu saldo de R$ {brl(reward)} como desconto 💛</p>
                    <div className="grid grid-cols-2 gap-3">
                      {lockedModules.map((m) => (
                        <button key={m.id} onClick={() => setPickedModule(m)} className="group text-left rounded-2xl border border-border bg-background overflow-hidden hover:border-primary/60 transition-colors">
                          <div className="aspect-[9/16] bg-gradient-to-br from-primary/20 to-primary/5 relative">
                            {m.image_url ? <img src={m.image_url} alt={m.title} className="w-full h-full object-cover" draggable={false} /> : <div className="w-full h-full flex items-center justify-center text-4xl">🚗</div>}
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-bold text-foreground line-clamp-2 leading-tight">{m.title}</p>
                            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black uppercase tracking-wider text-primary">Desbloquear <span className="material-symbols-outlined text-xs">arrow_forward</span></span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => nav("/")} className="w-full py-3 mt-4 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Deixar o saldo na carteira</button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="mx-auto mb-4 w-28 aspect-[9/16] rounded-xl overflow-hidden border-2 border-primary/40 shadow-lg">
                      {pickedModule.image_url ? <img src={pickedModule.image_url} alt={pickedModule.title} className="w-full h-full object-cover" draggable={false} /> : <div className="w-full h-full flex items-center justify-center text-4xl bg-primary/10">🚗</div>}
                    </div>
                    <h3 className="font-black text-lg text-foreground mb-1 leading-tight" style={{ textWrap: "balance" }}>{pickedModule.title}</h3>
                    <div className="flex items-start gap-2 text-left text-[12px] text-primary bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5 my-4">
                      <span className="material-symbols-outlined text-base mt-0.5">savings</span>
                      <span>Você tem <strong>R$ {brl(reward)}</strong> de saldo. Fale com a Carla no WhatsApp <strong>antes de pagar</strong> pra ela aplicar seu desconto no checkout. 💛</span>
                    </div>
                    <a href={waUrl(pickedModule)} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black px-4 py-3.5 rounded-2xl shadow-lg shadow-[#25D366]/30 uppercase tracking-wide text-xs transition-all mb-2">
                      <span className="material-symbols-outlined text-base">chat</span>Pegar meu desconto no WhatsApp
                    </a>
                    <button onClick={() => setCheckoutOpen(true)} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">lock_open</span>Ir pro checkout
                    </button>
                    <button onClick={() => setPickedModule(null)} className="w-full py-3 mt-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Voltar</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {phase === "quiz" && (
            <div className="flex items-center gap-2 px-5 py-3 border-t border-border">
              <button onClick={goBack} disabled={step === 0} className="px-4 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Voltar</button>
              <button onClick={goNext} disabled={!canAdvance || submitting} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5">
                {submitting ? <span className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : step === total - 1 ? <>Finalizar e resgatar 🪙</> : q?.optional && answers[q.id] == null ? <>Pular</> : <>Próxima</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {checkoutOpen && pickedModule?.checkout_slug && (
        <CheckoutModal open={checkoutOpen} onClose={() => { setCheckoutOpen(false); nav("/"); toast.success("Quase lá! 🎉", { description: "Assim que sua compra confirmar, o novo módulo aparece na sua área.", duration: 6000 }); }} contentId={pickedModule.checkout_slug} title={pickedModule.title} />
      )}
    </>
  );
}

// ─── Corpo da pergunta (por tipo) ────────────────────────────────────────────
function QuestionBody({ q, value, consent, onChange, onConsent, onPick }: {
  q: NpsQuestion; value: any; consent: boolean | undefined;
  onChange: (v: any) => void; onConsent: (c: boolean) => void; onPick: () => void;
}) {
  if (q.type === "nps") {
    return (
      <div>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} onClick={() => { onChange(n); onPick(); }} className={`aspect-square rounded-xl text-sm font-black transition-all ${value === n ? "bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/30" : "bg-background border border-border text-foreground hover:border-primary/50"}`}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium"><span>Não recomendaria</span><span>Recomendaria demais</span></div>
      </div>
    );
  }
  if (q.type === "scale5") {
    return (
      <div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => { onChange(n); onPick(); }} className={`py-4 rounded-xl text-lg font-black transition-all ${value === n ? "bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/30" : "bg-background border border-border text-foreground hover:border-primary/50"}`}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium"><span>{q.lowLabel}</span><span>{q.highLabel}</span></div>
      </div>
    );
  }
  if (q.type === "single") {
    return (
      <div className="flex flex-col gap-2">
        {q.options!.map((o) => (
          <button key={o.v} onClick={() => { onChange(o.v); onPick(); }} className={`text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${value === o.v ? "bg-primary/15 border-primary text-foreground" : "bg-background border-border text-foreground hover:border-primary/50"}`}>{o.l}</button>
        ))}
      </div>
    );
  }
  if (q.type === "multi") {
    const arr: string[] = Array.isArray(value) ? value : [];
    const max = q.maxSelect ?? 99;
    const toggle = (v: string) => { if (arr.includes(v)) onChange(arr.filter((x) => x !== v)); else if (arr.length < max) onChange([...arr, v]); };
    return (
      <div className="flex flex-col gap-2">
        {q.options!.map((o) => {
          const on = arr.includes(o.v);
          return (
            <button key={o.v} onClick={() => toggle(o.v)} className={`flex items-center gap-3 text-left px-4 py-3 rounded-xl text-sm font-bold transition-all border ${on ? "bg-primary/15 border-primary text-foreground" : "bg-background border-border text-foreground hover:border-primary/50"}`}>
              <span className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>{on && <span className="material-symbols-outlined text-primary-foreground text-sm">check</span>}</span>
              {o.l}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={q.type === "testimonial" ? 4 : 3} placeholder="Escreva aqui…" className="w-full px-3.5 py-3 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
      {q.type === "testimonial" && q.consentLabel && (
        <button onClick={() => onConsent(!consent)} className="flex items-start gap-2.5 mt-3 text-left w-full">
          <span className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${consent ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>{consent && <span className="material-symbols-outlined text-primary-foreground text-sm">check</span>}</span>
          <span className="text-xs text-muted-foreground leading-relaxed">{q.consentLabel}</span>
        </button>
      )}
    </div>
  );
}
