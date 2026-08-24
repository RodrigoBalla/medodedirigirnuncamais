import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playCelebrationSound } from "@/lib/sounds";
import confetti from "canvas-confetti";

interface Props {
  level: number;
  onClose: () => void;
}

export function LevelUpOverlay({ level, onClose }: Props) {
  useEffect(() => {
    playCelebrationSound();
    
    // Confetti burst
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
    >
      <motion.div 
        initial={{ scale: 0.5, y: 100, rotate: -10 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", damping: 15 }}
        className="max-w-md w-full bg-gradient-to-b from-primary/20 to-card border-2 border-primary/50 rounded-[40px] p-12 text-center shadow-[0_0_80px_rgba(var(--primary-rgb),0.3)] relative overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.2)_0%,transparent_70%)] pointer-events-none" />

        <motion.div 
          animate={{ 
            rotateY: [0, 360],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          className="size-32 bg-primary rounded-full mx-auto flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] border-4 border-white/20"
        >
          <span className="material-symbols-outlined text-white text-6xl filled-icon">military_tech</span>
        </motion.div>

        <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-2">Novo Nível Alcançado!</h2>
        <h1 className="text-6xl font-black text-foreground mb-4 tabular-nums">Nível {level}</h1>
        
        <p className="text-muted-foreground font-medium mb-10 leading-relaxed">
          Sua confiança está crescendo! Você acaba de desbloquear novas possibilidades em sua jornada.
        </p>

        <button 
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-lg hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-widest"
        >
          Continuar Subindo 🚀
        </button>
      </motion.div>
    </motion.div>
  );
}
