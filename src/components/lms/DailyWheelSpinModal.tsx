import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ─── DailyWheelSpinModal ─────────────────────────────────────────────────────
// Modal full-screen com a roleta animada estilo sales.html — 8 fatias com
// cadeados (em vez do nome do prêmio) escondendo qual saiu até a parada.
//
// Quando para, escurece a tela, faz o cadeado abrir (animação rotate+scale),
// dispara confetes e revela: "🎉 Parabéns! Você ganhou: [prêmio]"
//
// Fluxo:
//   1. Mount: carrega 8 prizes do banco, ordenados por display_order
//   2. Click "Girar" → chama spin_daily_wheel() em paralelo com a animação
//   3. Calcula ângulo final pra parar EXATAMENTE na fatia do prize sorteado
//   4. Reveal sequence: tela escura → cadeado abrindo → confetes → texto
// =============================================================================

interface Prize {
  id: string;
  code: string;
  label: string;
  prize_type: string;
  prize_value: number;
  icon: string;
  rarity: string;
}

interface SpinResult extends Prize {
  prize_id: string;
  prize_code: string;
  prize_label: string;
  prize_icon: string;
  expires_at: string;
  total_balance: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Disparado depois do reveal (3-4s após parar) — pra refresh do parent */
  onSpinComplete?: (result: SpinResult) => void;
}

const SLICE_COUNT = 8;
const DEG_PER_SLICE = 360 / SLICE_COUNT; // 45°

// Cores das fatias (alternadas amarelo/azul-marinho — paleta MDDNM)
function buildConicGradient(): string {
  const stops: string[] = [];
  for (let i = 0; i < SLICE_COUNT; i++) {
    const start = i * DEG_PER_SLICE;
    const end = start + DEG_PER_SLICE;
    const color = i % 2 === 0 ? "#FFD60A" : "#0B1A38";
    stops.push(`${color} ${start}deg ${end}deg`);
  }
  // Offset -22.5° pra que a 1ª fatia (índice 0) fique alinhada com o pointer no topo
  return `conic-gradient(from -${DEG_PER_SLICE / 2}deg, ${stops.join(", ")})`;
}

const RARITY_COPY: Record<string, { tag: string; color: string; bg: string }> = {
  common: { tag: "✨ Recompensa comum",  color: "text-slate-300",  bg: "from-slate-700/60 to-slate-900/60" },
  rare:   { tag: "💎 Recompensa rara",   color: "text-blue-300",   bg: "from-blue-700/60 to-purple-900/60" },
  epic:   { tag: "🏆 Prêmio ÉPICO",      color: "text-amber-300",  bg: "from-amber-600/60 to-yellow-700/60" },
};

export function DailyWheelSpinModal({ open, onClose, onSpinComplete }: Props) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealing" | "revealed">("idle");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Carrega catálogo de prêmios uma vez
  useEffect(() => {
    if (!open || prizes.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoadingPrizes(true);
      const { data } = await supabase
        .from("daily_wheel_prizes")
        .select("id, code, label, prize_type, prize_value, icon, rarity, display_order")
        .eq("active", true)
        .order("display_order");
      if (!cancelled && data) {
        setPrizes(data.slice(0, SLICE_COUNT) as Prize[]);
      }
      setLoadingPrizes(false);
    })();
    return () => { cancelled = true; };
  }, [open, prizes.length]);

  // Reset state quando fechar
  useEffect(() => {
    if (!open) {
      setPhase("idle");
      setRotation(0);
      setResult(null);
    }
  }, [open]);

  const conicGradient = useMemo(() => buildConicGradient(), []);

  async function handleSpin() {
    if (phase !== "idle" || prizes.length === 0) return;
    setPhase("spinning");

    try {
      // Dispara RPC + começa animação em paralelo. Aguarda os DOIS terminarem.
      const minSpinTime = new Promise((r) => setTimeout(r, 5500));
      const rpc = supabase.rpc("spin_daily_wheel");

      const [{ data, error }] = await Promise.all([rpc, minSpinTime]);
      if (error) throw error;
      const row = (data as SpinResult[])?.[0];
      if (!row) throw new Error("no_result");

      // Encontra o índice da fatia desse prize
      const idx = prizes.findIndex((p) => p.id === row.prize_id);
      const safeIdx = idx >= 0 ? idx : 0;

      // Ângulo final: 6 voltas + ângulo da fatia escolhida (negativo porque
      // o disco gira no sentido horário, mas o pointer fica fixo no topo)
      const targetSliceCenter = safeIdx * DEG_PER_SLICE;
      const fullSpins = 360 * 6;
      const finalRotation = fullSpins - targetSliceCenter;
      setRotation(finalRotation);

      // Aguarda a animação CSS terminar (1.6s extra pra ease) antes do reveal
      await new Promise((r) => setTimeout(r, 1600));
      setResult(row);
      setPhase("revealing");

      // Reveal: cadeado abrindo + confetes (1.5s) → mostra texto
      await new Promise((r) => setTimeout(r, 1500));
      setPhase("revealed");
      onSpinComplete?.(row);
    } catch (err) {
      console.warn("[wheel-modal] spin error:", err);
      setPhase("idle");
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={(e) => {
          // Fecha clicando fora SE não estiver no meio de animação
          if (e.target === e.currentTarget && phase === "idle") onClose();
        }}
      >
        {/* Backdrop dinâmico — mais escuro durante reveal */}
        <motion.div
          animate={{ opacity: phase === "revealing" || phase === "revealed" ? 0.95 : 0.85 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-black backdrop-blur-md"
          aria-hidden
        />

        {/* Container da roleta + reveal */}
        <motion.div
          initial={{ scale: 0.85, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="relative z-10 w-full max-w-md bg-gradient-to-br from-[#0E1B3F] to-[#050D24] border-2 border-primary rounded-3xl shadow-[0_0_140px_rgba(255,214,10,.35)] p-6 md:p-8"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-20"
            aria-label="Fechar"
            disabled={phase === "spinning" || phase === "revealing"}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>

          {/* Header */}
          <div className="text-center mb-5">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-black uppercase tracking-widest text-primary mb-2">
              ⚡ Roleta da Sorte
            </span>
            <h2 className="font-black text-xl md:text-2xl text-white leading-tight">
              {phase === "revealed"
                ? "🎉 Parabéns!"
                : phase === "revealing"
                ? "Abrindo o seu prêmio…"
                : phase === "spinning"
                ? "Girando…"
                : "Toque pra girar!"}
            </h2>
            {phase === "idle" && (
              <p className="text-xs text-white/60 mt-1">
                Cada fatia tem um cadeado · 1 prêmio sorteado a cada 24h
              </p>
            )}
          </div>

          {/* ROLETA */}
          <div className="relative w-full aspect-square max-w-[320px] mx-auto mb-5">
            {/* Pointer triangular no topo */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 size-0 border-l-[14px] border-r-[14px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_2px_8px_rgba(255,214,10,.7)]" />

            {/* Disco que gira */}
            <motion.div
              animate={{ rotate: rotation }}
              transition={{
                duration: phase === "spinning" ? 5.5 : 1.6,
                ease: phase === "spinning" ? [0.08, 0.78, 0.18, 1] : [0.45, 0.05, 0.55, 0.95],
              }}
              className="absolute inset-0 rounded-full border-4 border-primary shadow-[0_0_60px_rgba(255,214,10,.4),inset_0_0_0_3px_rgba(0,0,0,.3)]"
              style={{ background: conicGradient }}
            >
              {/* Cadeados em cada fatia (escondem o prêmio até abrir) */}
              {prizes.map((p, i) => {
                const angle = i * DEG_PER_SLICE;
                return (
                  <div
                    key={p.id}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
                  >
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: 0, top: -100 }}
                    >
                      <div className="size-9 rounded-full bg-black/45 border border-white/20 flex items-center justify-center">
                        <span className="material-symbols-outlined filled-icon text-lg text-white/90">
                          lock
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Hub central */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="size-16 rounded-full bg-gradient-to-br from-amber-300 via-primary to-amber-600 border-[3px] border-black shadow-[0_8px_24px_rgba(0,0,0,.7),inset_0_4px_12px_rgba(255,255,255,.3)] flex items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0B1A38]">
                  {phase === "spinning" ? "..." : "🎁"}
                </span>
              </div>
            </div>

            {/* Reveal overlay — escurece + cadeado abrindo + confetes */}
            <AnimatePresence>
              {(phase === "revealing" || phase === "revealed") && (
                <RevealOverlay phase={phase} result={result} />
              )}
            </AnimatePresence>
          </div>

          {/* Banner do prêmio quando revelado */}
          <AnimatePresence>
            {phase === "revealed" && result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 22 }}
                className={`relative bg-gradient-to-br ${RARITY_COPY[result.rarity]?.bg ?? RARITY_COPY.common.bg} border-2 border-white/20 rounded-2xl p-5 text-center mb-4 overflow-hidden`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest ${RARITY_COPY[result.rarity]?.color ?? "text-white/70"} mb-2`}>
                  {RARITY_COPY[result.rarity]?.tag ?? "✨ Recompensa"}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined filled-icon text-4xl text-primary drop-shadow-[0_2px_8px_rgba(255,214,10,.5)]">
                    {result.prize_icon}
                  </span>
                  <span className="font-black text-2xl text-white tracking-tight">
                    {result.prize_label}
                  </span>
                </div>
                <p className="text-[11px] text-white/60 mt-2">
                  Válido até {new Date(result.expires_at).toLocaleDateString("pt-BR")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA inferior */}
          {phase === "idle" && (
            <button
              onClick={handleSpin}
              disabled={loadingPrizes || prizes.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-yellow-500 text-primary-foreground font-black text-base uppercase tracking-widest shadow-[0_10px_30px_rgba(255,214,10,.5)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
            >
              🎰 Girar Roleta
            </button>
          )}
          {phase === "spinning" && (
            <div className="w-full py-4 rounded-2xl bg-white/5 text-white/50 text-center text-sm font-bold animate-pulse">
              A sorte está sendo decidida…
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// RevealOverlay — cadeado abrindo + confetes em cima da roleta
// ═════════════════════════════════════════════════════════════════════════════
function RevealOverlay({ phase, result }: { phase: "revealing" | "revealed"; result: SpinResult | null }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center pointer-events-none"
    >
      {/* Escurecimento */}
      <div className="absolute inset-0 rounded-full bg-black/70 backdrop-blur-sm" />

      {/* Cadeado central — vira lock_open com rotate */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{
          scale: phase === "revealed" ? 1.15 : 1,
          opacity: 1,
          rotate: phase === "revealed" ? [0, -15, 15, 0] : 0,
        }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative z-10"
      >
        <div className={`size-24 rounded-full border-4 ${
          phase === "revealed" ? "border-amber-400 bg-amber-400/20" : "border-white/40 bg-black/40"
        } flex items-center justify-center shadow-[0_0_60px_rgba(255,214,10,.6)] transition-colors duration-500`}>
          <span className={`material-symbols-outlined filled-icon text-5xl ${
            phase === "revealed" ? "text-amber-300" : "text-white"
          } transition-colors duration-500`}>
            {phase === "revealed" ? "lock_open" : "lock"}
          </span>
        </div>
      </motion.div>

      {/* Confetes (só quando revelado) */}
      {phase === "revealed" && <Confetti />}
    </motion.div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// Confetti — 40 partículas caindo com cor/delay/posição random
// (mesma vibe da .exit-confetti da sales.html)
// ═════════════════════════════════════════════════════════════════════════════
function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#FFD60A", "#FFB800", "#10B981", "#3B82F6", "#EC4899", "#A855F7"];
    return Array.from({ length: 40 }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 8,
      duration: 1.5 + Math.random() * 1.2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -20, opacity: 1, rotate: p.rotate }}
          animate={{ y: 400, opacity: 0, rotate: p.rotate + 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          className="absolute block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.4,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
