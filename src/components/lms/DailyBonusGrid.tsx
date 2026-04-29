import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { playCoinSound, playStreakSound } from "@/lib/sounds";

interface DailyBonusGridProps {
  currentStreak: number;
  onClaimBonus: (day: number, reward: { type: string; amount: number }) => void;
}

const DAILY_REWARDS = [
  { day: 1, icon: "paid", label: "+10", type: "coins", amount: 10, color: "text-yellow-500" },
  { day: 2, icon: "bolt", label: "+15 XP", type: "xp", amount: 15, color: "text-purple-500" },
  { day: 3, icon: "paid", label: "+25", type: "coins", amount: 25, color: "text-yellow-500" },
  { day: 4, icon: "favorite", label: "+1 ❤️", type: "life", amount: 1, color: "text-red-500" },
  { day: 5, icon: "paid", label: "+50", type: "coins", amount: 50, color: "text-yellow-500" },
  { day: 6, icon: "bolt", label: "+30 XP", type: "xp", amount: 30, color: "text-purple-500" },
  { day: 7, icon: "diamond", label: "BAÚ!", type: "chest", amount: 100, color: "text-cyan-400" },
];

export function DailyBonusGrid({ currentStreak, onClaimBonus }: DailyBonusGridProps) {
  const [claimedToday, setClaimedToday] = useState(false);
  const todaySlot = Math.min(currentStreak, 7);

  useEffect(() => {
    const lastClaim = localStorage.getItem("daily_bonus_claimed");
    if (lastClaim === new Date().toDateString()) {
      setClaimedToday(true);
    }
  }, []);

  const handleClaim = (dayIndex: number) => {
    if (claimedToday || dayIndex + 1 !== todaySlot) return;
    const reward = DAILY_REWARDS[dayIndex];
    playCoinSound();
    setTimeout(() => playStreakSound(), 300);
    onClaimBonus(dayIndex + 1, { type: reward.type, amount: reward.amount });
    setClaimedToday(true);
    localStorage.setItem("daily_bonus_claimed", new Date().toDateString());
  };

  return (
    <div className="bg-card rounded-[32px] border border-border p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-purple-500" />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-500 filled-icon">local_fire_department</span>
          Bônus Diário
        </h3>
        <span className="text-[10px] font-black text-muted-foreground">
          Dia {todaySlot}/7
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAILY_REWARDS.map((r, i) => {
          const isPast = i + 1 < todaySlot;
          const isToday = i + 1 === todaySlot && !claimedToday;
          const isClaimed = i + 1 === todaySlot && claimedToday;
          const isFuture = i + 1 > todaySlot;

          return (
            <motion.button
              key={i}
              whileTap={isToday ? { scale: 0.9 } : {}}
              onClick={() => handleClaim(i)}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all relative ${
                isPast || isClaimed
                  ? "bg-success/10 border-success/30 opacity-60"
                  : isToday
                  ? "bg-primary/10 border-primary shadow-lg shadow-primary/20 cursor-pointer animate-pulse"
                  : "bg-muted/30 border-border opacity-30"
              }`}
            >
              {isPast || isClaimed ? (
                <span className="material-symbols-outlined text-success text-lg filled-icon">check_circle</span>
              ) : (
                <span className={`material-symbols-outlined text-lg ${isToday ? r.color + " filled-icon" : "text-muted-foreground"}`}>
                  {r.icon}
                </span>
              )}
              <span className="text-[8px] font-black uppercase">{r.label}</span>
              <span className="text-[7px] text-muted-foreground font-bold">D{r.day}</span>
            </motion.button>
          );
        })}
      </div>

      {!claimedToday && todaySlot > 0 && todaySlot <= 7 && (
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center text-[10px] font-black uppercase text-primary mt-3 tracking-widest"
        >
          Toque no Dia {todaySlot} para resgatar!
        </motion.p>
      )}
    </div>
  );
}
