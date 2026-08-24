import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ─── DailyWheelSpinModal ─────────────────────────────────────────────────────
// COMPONENTE BURRO. Recebe phase + result + rotation como PROPS do parent.
// Não tem estado de spin interno — assim sobrevive a remounts e re-renders
// sem perder o reveal.
//
// Carrega só o catálogo de prêmios (pra desenhar as fatias) e dispara
// onSpin() quando o user clica no botão.
// =============================================================================

export interface WheelPrize {
  id: string;
  code: string;
  label: string;
  prize_type: string;
  prize_value: number;
  icon: string;
  rarity: string;
}

export interface SpinResult {
  prize_id: string;
  prize_code: string;
  prize_label: string;
  prize_type: string;
  prize_value: number;
  prize_icon: string;
  rarity: string;
  expires_at: string;
  total_balance: number;
}

export type SpinPhase = "idle" | "spinning" | "revealing" | "revealed";

interface Props {
  open: boolean;
  phase: SpinPhase;
  result: SpinResult | null;
  rotation: number;        // ângulo final do disco (em graus)
  onSpin: () => void;      // disparado pelo botão "Girar"
  onClose: () => void;
}

const SLICE_COUNT = 8;
const DEG_PER_SLICE = 360 / SLICE_COUNT;
const SPIN_DURATION = 3.5;      // segundos do giro principal (era 5.5)

function buildConicGradient(): string {
  const stops: string[] = [];
  for (let i = 0; i < SLICE_COUNT; i++) {
    const start = i * DEG_PER_SLICE;
    const end = start + DEG_PER_SLICE;
    const color = i % 2 === 0 ? "#FFD60A" : "#0B1A38";
    stops.push(`${color} ${start}deg ${end}deg`);
  }
  return `conic-gradient(from -${DEG_PER_SLICE / 2}deg, ${stops.join(", ")})`;
}

const RARITY_COPY: Record<string, { tag: string; color: string; bg: string; ring: string }> = {
  common: { tag: "✨ Recompensa comum", color: "text-slate-200", bg: "from-slate-700/80 to-slate-900/80", ring: "ring-slate-400/40" },
  rare:   { tag: "💎 Recompensa rara",  color: "text-blue-200",  bg: "from-blue-800/80 to-purple-900/80", ring: "ring-blue-400/50" },
  epic:   { tag: "🏆 Prêmio ÉPICO",     color: "text-amber-200", bg: "from-amber-700/80 to-yellow-900/80", ring: "ring-amber-400/60" },
};

// Explicação de cada tipo de prêmio: o que é + benefício + como usar.
// Mostrada no banner depois do reveal pra aluna entender o valor do que ganhou.
function prizeExplanation(result: SpinResult): { whatItIs: string; howToUse: string } {
  switch (result.prize_type) {
    case "coins":
      return {
        whatItIs: `Você ganhou ${result.prize_value} moedas 🪙 pra usar na loja do app.`,
        howToUse: "Use moedas pra comprar vidas extras, escudos de streak ou turbo XP. Elas também viram cupom de desconto em cursos novos.",
      };
    case "streak_freeze":
      return {
        whatItIs: "Um escudo que protege sua sequência de dias estudando 🛡️",
        howToUse: "Se você esquecer de estudar um dia, o escudo é ativado AUTOMATICAMENTE e seu recorde de dias seguidos não cai. Olhe na Mochila do perfil pra ver quantos você tem.",
      };
    case "xp_boost":
      return {
        whatItIs: `Turbo XP 2× ativado por ${result.prize_value} hora${result.prize_value > 1 ? "s" : ""} ⚡`,
        howToUse: `Por ${result.prize_value}h o XP que você ganhar em qualquer aula vai ser DOBRADO. Bom pra quando estiver com pique de estudar — começa a contar agora.`,
      };
    case "extra_life":
      return {
        whatItIs: "Uma vida extra ❤️ pra continuar errando sem esperar recarga",
        howToUse: "Foi adicionada AGORA aos seus corações. Quando errar uma resposta, você usa essa vida e segue na fase. Recarrega automaticamente, mas a extra te dá uma chance a mais.",
      };
    default:
      return {
        whatItIs: result.prize_label,
        howToUse: "Confira o seu inventário no perfil pra ver detalhes.",
      };
  }
}

export function DailyWheelSpinModal({ open, phase, result, rotation, onSpin, onClose }: Props) {
  const [prizes, setPrizes] = useState<WheelPrize[]>([]);

  // Carrega catálogo de prêmios uma vez quando o modal abre
  useEffect(() => {
    if (!open || prizes.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("daily_wheel_prizes")
        .select("id, code, label, prize_type, prize_value, icon, rarity, display_order")
        .eq("active", true)
        .order("display_order");
      if (!cancelled && data) {
        setPrizes(data.slice(0, SLICE_COUNT) as WheelPrize[]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, prizes.length]);

  const conicGradient = useMemo(() => buildConicGradient(), []);

  if (!open) return null;

  const isAnimating = phase === "spinning" || phase === "revealing";
  const showOverlay = phase === "revealing" || phase === "revealed";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop OPACO — sem deixar conteúdo da página vazar */}
      <div
        className="absolute inset-0 backdrop-blur-2xl"
        style={{ background: "rgba(2, 6, 17, 0.98)" }}
        aria-hidden
        onClick={() => { if (phase === "idle") onClose(); }}
      />

      {/* Confetes fullscreen quando revelando/revelado */}
      <AnimatePresence>
        {showOverlay && <FullScreenConfetti />}
      </AnimatePresence>

      {/* Modal box — mobile: max-w-md (coluna única). desktop: max-w-4xl (2 cols) */}
      <motion.div
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="relative z-10 w-full max-w-md md:max-w-4xl bg-gradient-to-br from-[#0E1B3F] to-[#050D24] border-2 border-primary rounded-3xl shadow-[0_0_140px_rgba(255,214,10,.5)] p-6 md:p-10 max-h-[95vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          disabled={isAnimating}
          className="absolute top-3 right-3 size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-20 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Fechar"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>

        {/* Grid: 1 coluna no mobile, 2 colunas no desktop (roleta + painel lateral) */}
        <div className="md:grid md:grid-cols-2 md:gap-10 md:items-center">

          {/* ── COLUNA ESQUERDA: header + roleta ──────────────────────────── */}
          <div>
            {/* Header dinâmico */}
            <div className="text-center mb-5">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                ⚡ Roleta da Sorte
              </span>
              <h2 className="font-black text-2xl md:text-4xl text-white leading-tight">
                {phase === "revealed"
                  ? "🎉 Parabéns!!"
                  : phase === "revealing"
                  ? "Abrindo o cadeado…"
                  : phase === "spinning"
                  ? "Girando…"
                  : "Toque pra girar!"}
              </h2>
              {phase === "idle" && (
                <p className="text-xs md:text-sm text-white/60 mt-1 md:mt-2">
                  Cada fatia tem um cadeado · 1 prêmio sorteado a cada 24h
                </p>
              )}
              {phase === "revealed" && result && (
                <p className="text-sm md:hidden text-white/80 mt-1">Você ganhou:</p>
              )}
            </div>

            {/* ROLETA — em desktop fica maior (380px) */}
            <div className="relative w-full aspect-square max-w-[300px] md:max-w-[380px] mx-auto mb-5 md:mb-0">
          {/* Pointer — pulsa suavemente quando idle pra chamar atenção */}
          <motion.div
            animate={phase === "idle" ? { y: [0, 3, 0], scale: [1, 1.05, 1] } : { y: 0, scale: 1 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 size-0 border-l-[14px] border-r-[14px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_2px_12px_rgba(255,214,10,.9)]"
          />

          {/* Disco */}
          <motion.div
            animate={{ rotate: rotation }}
            transition={{
              duration: phase === "spinning" ? SPIN_DURATION : 0,
              ease: phase === "spinning" ? [0.12, 0.7, 0.18, 1] : "linear",
            }}
            className="absolute inset-0 rounded-full border-4 border-primary shadow-[0_0_60px_rgba(255,214,10,.4)]"
            style={{ background: conicGradient }}
          >
            {prizes.map((p, i) => {
              const angle = i * DEG_PER_SLICE;
              return (
                <div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 pointer-events-none"
                  style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
                >
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: 0, top: -90 }}
                  >
                    <div className="size-9 rounded-full bg-black/55 border border-white/25 flex items-center justify-center">
                      <span className="material-symbols-outlined filled-icon text-lg text-white">
                        lock
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Hub central decorativo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="size-14 rounded-full bg-gradient-to-br from-amber-300 via-primary to-amber-600 border-[3px] border-black shadow-[0_8px_24px_rgba(0,0,0,.7),inset_0_4px_12px_rgba(255,255,255,.3)]" />
          </div>

          {/* Reveal overlay (cadeado abrindo + brilho) */}
          <AnimatePresence>
            {showOverlay && (
              <motion.div
                key="reveal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center pointer-events-none"
              >
                <div className="absolute inset-0 rounded-full bg-black/85 backdrop-blur-sm" />
                <motion.div
                  initial={{ scale: 0.4, opacity: 0, rotate: -15 }}
                  animate={{
                    scale: phase === "revealed" ? 1.25 : 1,
                    opacity: 1,
                    rotate: phase === "revealed" ? [0, -20, 20, -10, 10, 0] : 0,
                  }}
                  transition={{ duration: phase === "revealed" ? 0.9 : 0.5, type: "spring", stiffness: 180, damping: 14 }}
                  className="relative z-10"
                >
                  <div className={`size-32 rounded-full border-4 ${
                    phase === "revealed"
                      ? "border-amber-300 bg-gradient-to-br from-amber-400/40 to-yellow-500/40 shadow-[0_0_80px_rgba(255,214,10,.9)]"
                      : "border-white/40 bg-black/40"
                  } flex items-center justify-center transition-all duration-700`}>
                    <span className={`material-symbols-outlined filled-icon text-7xl transition-all duration-500 ${
                      phase === "revealed" ? "text-amber-200" : "text-white"
                    }`}>
                      {phase === "revealed" ? "lock_open" : "lock"}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
            </div>
          </div>

          {/* ── COLUNA DIREITA: banner do prêmio + botão ──────────────────── */}
          <div className="md:flex md:flex-col md:justify-between md:min-h-[480px] md:py-2">

            {/* Quando idle/spinning/revealing em desktop: mostra teaser */}
            {phase !== "revealed" && (
              <div className="hidden md:flex md:flex-col md:items-center md:justify-center md:text-center md:gap-4 md:py-8">
                <span className="material-symbols-outlined filled-icon text-[80px] text-primary/40 animate-pulse">
                  {phase === "spinning" ? "casino" : phase === "revealing" ? "key" : "lock"}
                </span>
                <p className="text-white/60 text-base font-medium leading-relaxed max-w-xs">
                  {phase === "spinning"
                    ? "A sorte está sendo decidida agora…"
                    : phase === "revealing"
                    ? "Quase lá! Seu prêmio está abrindo…"
                    : "Clique em GIRAR e descubra o que ganhou hoje. Pode ser moedas, escudo de streak, vidas extras ou turbo XP."}
                </p>
              </div>
            )}

            {/* Banner do prêmio (só quando revealed) */}
            <AnimatePresence>
          {phase === "revealed" && result && (
            <motion.div
              key={`prize-${result.prize_id}`}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 240, damping: 22 }}
              className={`relative bg-gradient-to-br ${RARITY_COPY[result.rarity]?.bg ?? RARITY_COPY.common.bg} border-2 border-white/30 rounded-2xl p-5 md:p-6 text-center mb-4 ring-2 ${RARITY_COPY[result.rarity]?.ring ?? "ring-white/20"} ring-offset-2 ring-offset-[#0E1B3F]`}
            >
              <p className={`text-[10px] font-black uppercase tracking-widest ${RARITY_COPY[result.rarity]?.color ?? "text-white/70"} mb-2`}>
                {RARITY_COPY[result.rarity]?.tag ?? "✨ Recompensa"}
              </p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <motion.span
                  initial={{ scale: 0.4, rotate: -180 }}
                  animate={{
                    scale: [1, 1.25, 1, 1.15, 1],
                    rotate: [0, -8, 8, -4, 0],
                  }}
                  transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                  className="material-symbols-outlined filled-icon text-5xl text-primary drop-shadow-[0_2px_12px_rgba(255,214,10,.8)] inline-block"
                >
                  {result.prize_icon}
                </motion.span>
                <span className="font-black text-3xl text-white tracking-tight">
                  {result.prize_label}
                </span>
              </div>

              {/* Explicação contextual: o que é + como usar */}
              {(() => {
                const exp = prizeExplanation(result);
                return (
                  <div className="text-left bg-black/30 rounded-xl p-3 mt-1 space-y-2 border border-white/10">
                    <p className="text-[12px] text-white/90 leading-snug font-medium">
                      {exp.whatItIs}
                    </p>
                    <div className="flex items-start gap-2 pt-1.5 border-t border-white/10">
                      <span className="material-symbols-outlined text-amber-300 text-base mt-px flex-shrink-0">
                        lightbulb
                      </span>
                      <p className="text-[11px] text-white/75 leading-snug">
                        <span className="font-black text-amber-200">Como usar:</span> {exp.howToUse}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[10px] text-white/60 mt-3 font-medium">
                ⏳ Válido até <span className="text-white/90 font-bold">{new Date(result.expires_at).toLocaleDateString("pt-BR")}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botões inferiores conforme phase */}
        {phase === "idle" && (
          <button
            onClick={onSpin}
            disabled={prizes.length === 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-yellow-500 text-primary-foreground font-black text-base uppercase tracking-widest shadow-[0_10px_30px_rgba(255,214,10,.5)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
          >
            🎰 Girar Roleta
          </button>
        )}
        {phase === "spinning" && (
          <div className="w-full py-4 rounded-2xl bg-white/5 text-white/60 text-center text-sm font-bold animate-pulse">
            A sorte está sendo decidida…
          </div>
        )}
        {phase === "revealing" && (
          <div className="w-full py-4 rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 text-amber-200 text-center text-sm font-bold animate-pulse">
            🔓 Abrindo o seu prêmio…
          </div>
        )}
        {phase === "revealed" && (
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-yellow-500 text-primary-foreground font-black text-base uppercase tracking-widest shadow-[0_10px_30px_rgba(255,214,10,.5)] hover:scale-[1.02] active:scale-95 transition-transform"
          >
            ✨ Fechar e usar
          </button>
        )}
          </div>
          {/* ── /COLUNA DIREITA ────────────────────────────────────────── */}
        </div>
        {/* /grid 2-cols */}
      </motion.div>
    </div>
  );
}


// ─── FullScreenConfetti — confetes na tela inteira ──────────────────────────
function FullScreenConfetti() {
  const pieces = useMemo(() => {
    const colors = ["#FFD60A", "#FFB800", "#10B981", "#3B82F6", "#EC4899", "#A855F7", "#F97316"];
    return Array.from({ length: 60 }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      size: 8 + Math.random() * 10,
      duration: 2 + Math.random() * 1.5,
    }));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 overflow-hidden pointer-events-none z-[210]"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -40, opacity: 1, rotate: p.rotate }}
          animate={{ y: 800, opacity: [1, 1, 0], rotate: p.rotate + 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          className="absolute block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.4,
            background: p.color,
            boxShadow: `0 0 12px ${p.color}80`,
          }}
        />
      ))}
    </motion.div>
  );
}
