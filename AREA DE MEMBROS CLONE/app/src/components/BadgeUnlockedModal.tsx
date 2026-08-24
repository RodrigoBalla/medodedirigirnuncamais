import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playPrizeRevealSound } from "@/lib/sounds";

// ─── BadgeUnlockedModal ──────────────────────────────────────────────────────
// Modal celebratório que aparece quando o aluno desbloqueia uma medalha.
// Inclui confetti fullscreen, scale + rotação no ícone, som de fanfarra e
// um botão "Continuar" pra fechar.
// =============================================================================

interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface Props {
  badge: Badge | null;
  onClose: () => void;
}

export function BadgeUnlockedModal({ badge, onClose }: Props) {
  // Toca som ao abrir + bloqueia scroll + ESC fecha
  useEffect(() => {
    if (!badge) return;
    try { playPrizeRevealSound(); } catch {}
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [badge, onClose]);

  return (
    <AnimatePresence>
      {badge && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            aria-hidden
          />

          {/* Confetti fullscreen */}
          <FullScreenConfetti />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.6, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative z-10 w-full max-w-sm bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-700/30 border-2 border-amber-400 rounded-3xl shadow-[0_0_120px_rgba(255,214,10,.6)] p-8 text-center"
          >
            {/* Header curto */}
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-2">
              🏅 Medalha Desbloqueada!
            </p>

            <h2 className="font-black text-3xl text-white tracking-tight mb-1">
              {badge.name}
            </h2>
            <p className="text-sm text-white/80 mb-6">{badge.description}</p>

            {/* Ícone gigante com animação */}
            <motion.div
              initial={{ scale: 0.3, rotate: -180 }}
              animate={{
                scale: [0.3, 1.3, 1, 1.15, 1],
                rotate: [0, 0, -8, 8, 0],
              }}
              transition={{ duration: 1.4, delay: 0.2, ease: "easeOut" }}
              className="mx-auto mb-6"
            >
              <div className="size-32 mx-auto rounded-3xl bg-white/10 border-4 border-amber-400 flex items-center justify-center shadow-[0_0_60px_rgba(255,214,10,.8)]">
                <span className={`material-symbols-outlined filled-icon text-7xl ${badge.color}`}>
                  {badge.icon}
                </span>
              </div>
            </motion.div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-base uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-transform"
            >
              ✨ Show!
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── FullScreenConfetti — replicado do DailyWheelSpinModal ──────────────────
function FullScreenConfetti() {
  const pieces = useMemo(() => {
    const colors = ["#FFD60A", "#FFB800", "#10B981", "#3B82F6", "#EC4899", "#A855F7", "#F97316"];
    return Array.from({ length: 80 }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      size: 8 + Math.random() * 12,
      duration: 2.4 + Math.random() * 1.5,
    }));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 overflow-hidden pointer-events-none z-[190]"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -50, opacity: 1, rotate: p.rotate }}
          animate={{ y: 900, opacity: [1, 1, 0], rotate: p.rotate + 720 }}
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
