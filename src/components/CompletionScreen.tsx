import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { playCelebrationSound, playHornSound } from "@/lib/sounds";

const confettiColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function CompletionScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const xp = parseInt(searchParams.get("xp") || "100", 10);
  const phaseIndex = parseInt(searchParams.get("phase") || "0", 10);
  const phaseName = searchParams.get("name") || "Fase";

  const [showCelebration, setShowCelebration] = useState(true);

  useEffect(() => {
    playCelebrationSound();
    setTimeout(() => playHornSound(), 600);
    const timer = setTimeout(() => setShowCelebration(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.92) 0%, rgba(59,130,246,0.95) 100%)" }}
          >
            {/* Confetti */}
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={`confetti-${i}`}
                initial={{
                  x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 800) - 400,
                  y: -40,
                  rotate: 0,
                  opacity: 1,
                  scale: Math.random() * 0.6 + 0.6,
                }}
                animate={{
                  y: (typeof window !== "undefined" ? window.innerHeight : 800) + 40,
                  rotate: Math.random() * 720 - 360,
                  opacity: [1, 1, 0.7, 0],
                }}
                transition={{
                  duration: Math.random() * 2.5 + 2,
                  delay: Math.random() * 1.5,
                  ease: "easeIn",
                }}
                className="absolute top-0 left-1/2 pointer-events-none"
                style={{
                  width: `${Math.random() * 10 + 6}px`,
                  height: `${Math.random() * 14 + 8}px`,
                  background: confettiColors[i % confettiColors.length],
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                }}
              />
            ))}

            {/* Clapping emojis */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.span
                key={`clap-${i}`}
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: Math.random() * 300 - 150,
                  y: Math.random() * 200 - 100,
                }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.3, 1, 0.5],
                  y: [0, -80 - Math.random() * 120],
                }}
                transition={{
                  duration: 2.5,
                  delay: 0.5 + Math.random() * 2,
                  ease: "easeOut",
                }}
                className="absolute text-3xl sm:text-4xl pointer-events-none"
              >
                👏
              </motion.span>
            ))}

            {/* Central content */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 150, delay: 0.2 }}
              className="flex flex-col items-center text-center z-10 px-4"
            >
              <motion.span
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: 2 }}
                className="text-7xl sm:text-8xl mb-4"
              >
                🏆
              </motion.span>
              <motion.h1
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-4xl sm:text-5xl font-black text-white mb-2 drop-shadow-lg"
              >
                Parabéns!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg font-bold text-white/90 mb-2"
              >
                Fase Concluída!
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-3 mt-2"
              >
                <span className="text-2xl font-black text-white">+{xp} XP ⚡</span>
              </motion.div>
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.span
                  key={`star-${i}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    x: Math.cos((i / 6) * Math.PI * 2) * 120,
                    y: Math.sin((i / 6) * Math.PI * 2) * 120,
                  }}
                  transition={{ duration: 2, delay: 1 + i * 0.2, repeat: 1 }}
                  className="absolute text-2xl pointer-events-none"
                >
                  ⭐
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content — visible after celebration ends */}
      {!showCelebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex-1 flex flex-col items-center justify-center px-4 py-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl px-6 py-3 mb-6 flex items-center gap-3 text-primary-foreground"
          >
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-extrabold text-sm">Fase Concluída!</p>
              <p className="text-xs opacity-80">+{xp} XP ganhos ⚡</p>
            </div>
          </motion.div>

          {/* Video */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-card rounded-2xl border border-border overflow-hidden w-full max-w-sm mb-6"
          >
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 aspect-[9/16] flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="size-16 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-3xl filled-icon">play_arrow</span>
                </motion.div>
              </div>
              <div className="absolute top-3 left-3">
                <span className="bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg">
                  Mensagem da Mentora
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">0:00 / 2:00</span>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "0%" }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <p className="text-sm font-bold text-foreground mb-1">Mensagem da mentora Karla</p>
              <p className="text-xs text-muted-foreground">Ela tem uma mensagem especial para você!</p>
            </div>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-sm flex flex-col gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/")}
              className="w-full bg-primary text-primary-foreground font-extrabold py-4 rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 text-base"
            >
              Continuar →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/")}
              className="w-full bg-card text-foreground border-2 border-border font-bold py-3.5 rounded-2xl hover:bg-muted transition-colors text-sm"
            >
              Voltar ao Dashboard 🏠
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      <footer className="bg-card border-t border-border px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">© 2026 Medo de dirigir nunca mais - Sistema de Aprendizado Prático</p>
      </footer>
    </div>
  );
}
