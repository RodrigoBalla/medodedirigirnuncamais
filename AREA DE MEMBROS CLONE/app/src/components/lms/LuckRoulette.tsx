import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  playCorrectSound, 
  playWrongSound, 
  playCheckSound, 
  playCelebrationSound,
} from "@/lib/sounds";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { toast } from "sonner";

interface Props {
  onComplete: () => void;
}

type Prize = {
  id: string;
  label: string;
  icon: string;
  color: string;
  value: number;
  type: "coins" | "lives" | "xp" | "nothing";
};

const PRIZES: Prize[] = [
  { id: "1", label: "+10 Moedas", icon: "database", color: "bg-amber-500", value: 10, type: "coins" },
  { id: "2", label: "+1 Vida", icon: "favorite", color: "bg-red-500", value: 1, type: "lives" },
  { id: "3", label: "+50 XP", icon: "stars", color: "bg-blue-500", value: 50, type: "xp" },
  { id: "4", label: "Azar! Zero", icon: "close", color: "bg-gray-500", value: 0, type: "nothing" },
  { id: "5", label: "+20 Moedas", icon: "database", color: "bg-amber-600", value: 20, type: "coins" },
  { id: "6", label: "+5 Moedas", icon: "database", color: "bg-amber-400", value: 5, type: "coins" },
];

export function LuckRoulette({ onComplete }: Props) {
  const { addCoins, addXP } = useUserProgress();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setResult(null);
    playCheckSound();

    // Random prize
    const prizeIndex = Math.floor(Math.random() * PRIZES.length);
    const extraSpins = 5 + Math.floor(Math.random() * 5); // 5 to 10 full turns
    const sectorAngle = 360 / PRIZES.length;
    const finalRotation = rotation + (extraSpins * 360) + (prizeIndex * sectorAngle);
    
    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      const prize = PRIZES[prizeIndex];
      setResult(prize);
      handlePrize(prize);
    }, 4000); // Animation duration
  };

  const handlePrize = (prize: Prize) => {
    if (prize.type === "coins") {
      addCoins(prize.value);
      playCelebrationSound();
      toast.success(`Você ganhou ${prize.label}! 🪙`);
    } else if (prize.type === "xp") {
      addXP(prize.value);
      playCelebrationSound();
      toast.success(`Você ganhou ${prize.label}! ✨`);
    } else if (prize.type === "nothing") {
      playWrongSound();
      toast.error("Que azar! Não ganhou nada dessa vez. 😅");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="max-w-md w-full text-center">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div 
              key="spinning"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                {isSpinning ? "Girando a Sorte..." : "Gire Para Ganhar!"}
              </h2>
              
              <div className="relative size-64 md:size-80 mx-auto">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-10">
                   <div className="w-6 h-10 bg-white clip-path-triangle shadow-lg"/>
                </div>
                <motion.div 
                  className="size-full rounded-full border-8 border-white/20 relative overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)]"
                  animate={{ rotate: rotation }}
                  transition={{ duration: 4, ease: [0.15, 0, 0.15, 1] }}
                >
                  {PRIZES.map((prize, i) => (
                    <div 
                      key={prize.id}
                      className={`absolute top-0 left-0 size-full ${prize.color} flex flex-col items-center pt-10 text-white`}
                      style={{ 
                        clipPath: 'polygon(50% 50%, 0% 0%, 100% 0%)',
                        transform: `rotate(${i * (360 / PRIZES.length)}deg)`
                      }}
                    >
                      <span className="material-symbols-outlined text-2xl mb-1">{prize.icon}</span>
                      <span className="text-[10px] font-black uppercase whitespace-nowrap">{prize.label}</span>
                    </div>
                  ))}
                  <div className="absolute inset-x-0 inset-y-0 m-auto size-16 bg-white rounded-full flex items-center justify-center shadow-lg z-20">
                    <span className="material-symbols-outlined text-primary text-3xl">casino</span>
                  </div>
                </motion.div>
              </div>

              {!isSpinning && (
                <button 
                  onClick={spin}
                  className="w-full bg-primary text-primary-foreground font-black text-xl py-6 rounded-2xl shadow-[0_10px_0_0_rgba(var(--primary-rgb),0.5)] hover:translate-y-1 hover:shadow-none transition-all active:scale-95 animate-bounce"
                >
                  GIRAR AGORA! 🚀
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 50, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="bg-card border-4 border-primary rounded-3xl p-10 shadow-[0_0_40px_rgba(var(--primary-rgb),0.4)]"
            >
              <div className={`size-24 rounded-full ${result.color} mx-auto flex items-center justify-center mb-6 shadow-xl`}>
                <span className="material-symbols-outlined text-5xl text-white filled-icon">{result.icon}</span>
              </div>
              <h3 className="text-4xl font-black text-foreground mb-2 uppercase italic">{result.label}</h3>
              <p className="text-muted-foreground font-medium mb-8">Sua recompensa foi creditada!</p>
              
              <button 
                onClick={onComplete}
                className="w-full bg-foreground text-background font-black py-4 rounded-xl hover:bg-foreground/80 transition-colors uppercase tracking-widest"
              >
                Continuar Jornada
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
