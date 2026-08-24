import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { supabase } from "@/integrations/supabase/client";
import { playCoinSound, playCheckSound } from "@/lib/sounds";
import { toast } from "sonner";

// Tabela/RPC novas ainda não estão nos types gerados → cast localizado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/** Dia-calendário em America/Sao_Paulo (YYYY-MM-DD) — bate com a claim_date da RPC. */
function spToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// ─── Missões Diárias ─────────────────────────────────────────────────────────
// O "já resgatei" e o CRÉDITO de cada missão vivem no BANCO (não mais em
// localStorage): sincroniza mobile/web e a aluna não resgata em dobro. A RPC
// claim_daily_mission() é idempotente (1 crédito por dia/missão) e valida
// server-side que a missão está mesmo cumprida. Migração do localStorage antigo
// no mount, SEM re-creditar.
// =============================================================================
export function DailyMissions() {
  const { user } = useAuth();
  const { dailyXP, dailyLessons, streak, refreshProgress } = useUserProgress();
  const [claimed, setClaimed] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const today = spToday();

      // 1) Migra o "resgatado hoje" do localStorage → banco (SEM re-creditar).
      try {
        const lastDate = localStorage.getItem("daily_missions_date");
        if (lastDate === new Date().toDateString()) {
          const stored: string[] = JSON.parse(localStorage.getItem("daily_missions_claimed") || "[]");
          if (Array.isArray(stored) && stored.length) {
            await sb.from("daily_mission_claims").upsert(
              stored.map((mission_id) => ({
                user_id: user.id, claim_date: today, mission_id, reward_type: "legacy",
              })),
              { onConflict: "user_id,claim_date,mission_id", ignoreDuplicates: true },
            );
          }
        }
        localStorage.removeItem("daily_missions_date");    // migrado; não repete
        localStorage.removeItem("daily_missions_claimed");
      } catch { /* localStorage indisponível/JSON inválido → ignora */ }

      // 2) Carrega do banco os resgates de hoje (fonte de verdade).
      const { data } = await sb
        .from("daily_mission_claims")
        .select("mission_id")
        .eq("user_id", user.id)
        .eq("claim_date", today);
      if (!active) return;
      setClaimed((data ?? []).map((r: { mission_id: string }) => r.mission_id));
    })();
    return () => { active = false; };
  }, [user]);

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

  const handleClaim = async (missionId: string, rewardType: string, rewardAmount: number) => {
    if (claimed.includes(missionId) || claiming) return;
    setClaiming(missionId);
    // Otimista: marca resgatado já (a RPC confirma/reverte logo abaixo).
    setClaimed((prev) => [...prev, missionId]);

    playCoinSound();
    setTimeout(() => playCheckSound(), 200);

    const { data, error } = await sb.rpc("claim_daily_mission", { p_mission_id: missionId });
    if (!data?.credited) {
      // Não creditou. Se foi erro ou a missão não estava cumprida no servidor,
      // reverte o otimismo. Se já estava resgatada (outro dispositivo), mantém
      // marcada — está resgatada de verdade, só não creditou de novo.
      if (error || data?.reason !== "already_claimed") {
        setClaimed((prev) => prev.filter((id) => id !== missionId));
      }
      setClaiming(null);
      return;
    }

    if (rewardType === "coins") {
      toast.success("Missão Concluída! 🎯", { description: `+${rewardAmount} moedas`, icon: "🪙" });
    } else {
      toast.success("Missão Concluída! 🎯", { description: `+${rewardAmount} XP`, icon: "⚡" });
    }
    await refreshProgress(); // sincroniza moedas/XP do header
    setClaiming(null);
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
                  disabled={claiming === m.id}
                  onClick={() => handleClaim(m.id, m.rewardType, m.rewardAmount)}
                  className="relative z-10 mt-1 w-full bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-wider py-1.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 animate-pulse disabled:opacity-60"
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
