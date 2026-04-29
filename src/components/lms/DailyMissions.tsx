import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { playCoinSound, playCheckSound } from "@/lib/sounds";
import { toast } from "sonner";

export function DailyMissions() {
  const { dailyXP, dailyLessons, streak, addCoins, addXP } = useUserProgress();
  const [claimed, setClaimed] = useState<string[]>([]);

  useEffect(() => {
    // Load claimed from localStorage. Reset if day changed.
    const lastClaimDate = localStorage.getItem("daily_missions_date");
    const today = new Date().toDateString();
    if (lastClaimDate !== today) {
      localStorage.setItem("daily_missions_date", today);
      localStorage.setItem("daily_missions_claimed", JSON.stringify([]));
      setClaimed([]);
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem("daily_missions_claimed") || "[]");
        setClaimed(stored);
      } catch {
        setClaimed([]);
      }
    }
  }, []);

  const missions = [
    {
      id: "xp_50",
      text: "Meta de XP Diária",
      progress: `${Math.min(dailyXP, 50)}/50`,
      done: dailyXP >= 50,
      icon: "trending_up",
      rewardAmount: 15,
      rewardType: "coins"
    },
    {
      id: "lesson_1",
      text: "Completar uma lição",
      progress: `${Math.min(dailyLessons, 1)}/1`,
      done: dailyLessons >= 1,
      icon: "menu_book",
      rewardAmount: 20,
      rewardType: "xp"
    },
    {
      id: "streak_1",
      text: "Sequência de Fogo",
      progress: `${streak} d`,
      done: streak > 0,
      icon: "local_fire_department",
      rewardAmount: 10,
      rewardType: "coins"
    },
  ];

  const handleClaim = (missionId: string, rewardType: string, rewardAmount: number) => {
    if (claimed.includes(missionId)) return;
    
    // Play sounds and animations
    playCoinSound();
    setTimeout(() => playCheckSound(), 200);
    
    // Add rewards
    if (rewardType === "coins") {
      addCoins(rewardAmount);
      toast.success("Missão Concluída! 🎯", { description: `+${rewardAmount} moedas`, icon: "🪙" });
    } else {
      addXP(rewardAmount);
      // addXP already throws a toast sometimes, but a direct toast is good:
      toast.success("Missão Concluída! 🎯", { description: `+${rewardAmount} XP`, icon: "⚡" });
    }

    // Save claim state
    const newClaimed = [...claimed, missionId];
    setClaimed(newClaimed);
    localStorage.setItem("daily_missions_claimed", JSON.stringify(newClaimed));
  };

  return (
    <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-lg">target</span>
        Missões Diárias
      </h3>
      <div className="flex flex-col gap-3">
        {missions.map((m) => {
          const isClaimed = claimed.includes(m.id);
          const canClaim = m.done && !isClaimed;

          return (
            <div key={m.id} className="flex flex-col gap-2 p-3 bg-accent/30 rounded-lg border border-border/50 relative overflow-hidden">
              {isClaimed && (
                <div className="absolute inset-0 bg-success/10 z-0" />
              )}
              <div className="flex items-center gap-3 relative z-10">
                <span className={`material-symbols-outlined text-xl ${isClaimed ? "text-success filled-icon" : m.done ? "text-primary filled-icon" : "text-muted-foreground"}`}>
                  {isClaimed ? "check_circle" : m.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold truncate ${isClaimed ? "text-success" : ""}`}>{m.text}</p>
                  {!isClaimed && (
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-muted-foreground">{m.progress}</p>
                      <p className={`text-[10px] font-black uppercase flex items-center gap-0.5 ${m.rewardType === "coins" ? "text-yellow-500" : "text-purple-500"}`}>
                        <span className="material-symbols-outlined text-[10px] filled-icon">
                          {m.rewardType === "coins" ? "paid" : "bolt"}
                        </span>
                        +{m.rewardAmount}
                      </p>
                    </div>
                  )}
                  {isClaimed && (
                    <p className="text-[10px] font-black text-success uppercase">Resgatado</p>
                  )}
                </div>
              </div>
              
              {canClaim && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleClaim(m.id, m.rewardType, m.rewardAmount)}
                  className="relative z-10 mt-1 w-full bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-wider py-1.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 animate-pulse"
                >
                  Resgatar Recompensa
                </motion.button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
