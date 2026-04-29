import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

interface UserProgressContextType {
  lives: number;
  coins: number;
  totalXP: number;
  completedPhases: number[];
  completedLessons: string[];
  confidence: number;
  streak: number;
  lastLoginAt: string | null;
  loading: boolean;
  loseLife: () => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  completeLesson: (lessonId: string) => Promise<void>;
  completePhase: (phaseId: number) => Promise<void>;
  updateConfidence: (val: number) => Promise<void>;
  level: number;
  league: string;
  badges: string[];
  dailyXP: number;
  dailyLessons: number;
  streakFreezeCount: number;
  xpBoostExpiresAt: string | null;
  buyItem: (itemType: "life" | "full_lives" | "streak_freeze" | "xp_boost") => Promise<boolean>;
  addBadge: (badgeId: string) => Promise<void>;
  spendCoins: (amount: number) => Promise<boolean>;
}

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

export const useUserProgress = () => {
  const context = useContext(UserProgressContext);
  if (!context) {
    throw new Error("useUserProgress must be used within a UserProgressProvider");
  }
  return context;
};

export const UserProgressProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [lives, setLives] = useState(5);
  const [coins, setCoins] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(3);
  const [streak, setStreak] = useState(0);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [league, setLeague] = useState("Bronze");
  const [badges, setBadges] = useState<string[]>([]);
  const [dailyXP, setDailyXP] = useState(0);
  const [dailyLessons, setDailyLessons] = useState(0);
  const [streakFreezeCount, setStreakFreezeCount] = useState(0);
  const [xpBoostExpiresAt, setXpBoostExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchProgress = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching progress:", error);
      } else if (data) {
        setLives(data.lives ?? 5);
        setCoins(data.coins ?? 0);
        setTotalXP(data.total_xp ?? 0);
        setCompletedPhases(data.completed_phases ?? []);
        setCompletedLessons(data.completed_lessons ?? []);
        setConfidence(data.confidence ?? 3);
        setLeague(data.league ?? "Bronze");
        setBadges(data.badges ?? []);
        setDailyXP(data.daily_xp ?? 0);
        setDailyLessons(data.daily_lessons ?? 0);
        setStreakFreezeCount(data.streak_freeze_count ?? 0);
        setXpBoostExpiresAt(data.xp_boost_expires_at);
        
        // Streak Logic
        const now = new Date();
        const lastLogin = data.last_login_at ? new Date(data.last_login_at) : null;
        let newStreak = data.streak ?? 0;
        
        if (!lastLogin) {
          newStreak = 1;
        } else {
          const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
          const isSameDay = now.toDateString() === lastLogin.toDateString();
          
          if (!isSameDay) {
            // Reset daily stats on new day
            await supabase
              .from("user_progress")
              .update({ daily_xp: 0, daily_lessons: 0 })
              .eq("user_id", user.id);
            setDailyXP(0);
            setDailyLessons(0);

            if (hoursSinceLastLogin <= 48) {
              newStreak += 1;
            } else if (data.streak_freeze_count > 0) {
              const newFreezeCount = data.streak_freeze_count - 1;
              setStreakFreezeCount(newFreezeCount);
              await supabase
                .from("user_progress")
                .update({ streak_freeze_count: newFreezeCount })
                .eq("user_id", user.id);
              toast.success("O seu Escudo de Ofensiva te salvou! 🔥");
              newStreak = data.streak ?? 1;
            } else {
              newStreak = 1;
            }
          }
        }
        
        setStreak(newStreak);
        setLastLoginAt(now.toISOString());
        setLevel(Math.floor((data.total_xp ?? 0) / 100) + 1);
        
        await supabase
          .from("user_progress")
          .update({ streak: newStreak, last_login_at: now.toISOString() })
          .eq("user_id", user.id);
      }
      setLoading(false);
    };

    fetchProgress();

    const channel = supabase
      .channel("user_progress_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_progress", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newData = payload.new;
          setLives(newData.lives ?? 5);
          setCoins(newData.coins ?? 0);
          setTotalXP(newData.total_xp ?? 0);
          setConfidence(newData.confidence ?? 3);
          setStreakFreezeCount(newData.streak_freeze_count ?? 0);
          setXpBoostExpiresAt(newData.xp_boost_expires_at);
          setLevel(Math.floor((newData.total_xp ?? 0) / 100) + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loseLife = async () => {
    if (!user || lives <= 0) return;
    const newLives = lives - 1;
    setLives(newLives);
    await supabase.from("user_progress").update({ lives: newLives }).eq("user_id", user.id);
  };

  const addCoins = async (amount: number) => {
    if (!user) return;
    const newCoins = coins + amount;
    setCoins(newCoins);
    await supabase.from("user_progress").update({ coins: newCoins }).eq("user_id", user.id);
  };

  const spendCoins = async (amount: number): Promise<boolean> => {
    if (!user) return false;
    if (coins < amount) {
      toast.error("Moedas insuficientes!");
      return false;
    }
    const newCoins = coins - amount;
    setCoins(newCoins);
    await supabase.from("user_progress").update({ coins: newCoins }).eq("user_id", user.id);
    return true;
  };

  const addXP = async (amount: number) => {
    if (!user) return;
    let actualAmount = amount;
    if (xpBoostExpiresAt && new Date(xpBoostExpiresAt) > new Date()) actualAmount *= 2;

    const newXP = totalXP + actualAmount;
    const newDailyXP = dailyXP + actualAmount;
    
    // League Logic 🏅
    let newLeague = league;
    if (newXP >= 5000) newLeague = "Diamante";
    else if (newXP >= 2500) newLeague = "Ouro";
    else if (newXP >= 1000) newLeague = "Prata";
    else newLeague = "Bronze";

    if (newLeague !== league) {
      setLeague(newLeague);
      toast.success(`PROMOÇÃO! 🏅 Você subiu para a Liga ${newLeague}!`);
    }

    setTotalXP(newXP);
    setDailyXP(newDailyXP);

    await supabase.from("user_progress").update({ 
      total_xp: newXP, 
      daily_xp: newDailyXP,
      league: newLeague 
    }).eq("user_id", user.id);

    if (actualAmount > amount) {
      toast.success("Bônus de XP Ativo! 🏃‍♂️💨", { description: `+${actualAmount} XP` });
    }
  };

  const completeLesson = async (lessonId: string) => {
    if (!user || completedLessons.includes(lessonId)) return;
    const newList = [...completedLessons, lessonId];
    const newDailyLessons = dailyLessons + 1;
    setCompletedLessons(newList);
    setDailyLessons(newDailyLessons);
    await supabase.from("user_progress").update({ 
      completed_lessons: newList,
      daily_lessons: newDailyLessons
    }).eq("user_id", user.id);
  };

  const completePhase = async (phaseId: number) => {
    if (!user || completedPhases.includes(phaseId)) return;
    const newList = [...completedPhases, phaseId];
    setCompletedPhases(newList);
    await supabase.from("user_progress").update({ completed_phases: newList }).eq("user_id", user.id);
  };

  const updateConfidence = async (val: number) => {
    if (!user) return;
    setConfidence(val);
    await supabase.from("user_progress").update({ confidence: val }).eq("user_id", user.id);
  };

  const buyItem = async (itemType: "life" | "full_lives" | "streak_freeze" | "xp_boost"): Promise<boolean> => {
    if (!user) return false;
    let cost = 0; let updates: any = {}; let successMessage = "";

    switch (itemType) {
      case "life": 
        cost = 50; if (lives >= 5) { toast.error("Vidas no máximo!"); return false; }
        updates = { lives: lives + 1 }; successMessage = "+1 vida! ❤️"; break;
      case "full_lives":
        cost = 200; if (lives >= 5) { toast.error("Vidas no máximo!"); return false; }
        updates = { lives: 5 }; successMessage = "Vidas restauradas! ⚡"; break;
      case "streak_freeze":
        cost = 300; updates = { streak_freeze_count: streakFreezeCount + 1 };
        successMessage = "Escudo de Ofensiva ativado! 🛡️"; break;
      case "xp_boost":
        cost = 150; const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 2);
        updates = { xp_boost_expires_at: expiresAt.toISOString() };
        successMessage = "XP Turbo ativado! 🔥"; break;
    }

    if (coins < cost) { toast.error("Moedas insuficientes!"); return false; }
    const newCoins = coins - cost;
    const { error } = await supabase.from("user_progress").update({ ...updates, coins: newCoins }).eq("user_id", user.id);
    if (!error) {
       setCoins(newCoins);
       if (updates.lives) setLives(updates.lives);
       if (updates.streak_freeze_count) setStreakFreezeCount(updates.streak_freeze_count);
       if (updates.xp_boost_expires_at) setXpBoostExpiresAt(updates.xp_boost_expires_at);
       toast.success(successMessage);
       return true;
    }
    return false;
  };

  const addBadge = async (badgeId: string) => {
    if (!user || badges.includes(badgeId)) return;
    const newList = [...badges, badgeId];
    setBadges(newList);
    await supabase.from("user_progress").update({ badges: newList }).eq("user_id", user.id);
    toast.success("Nova Medalha Conquistada! 🏅", { description: badgeId });
  };

  return (
    <UserProgressContext.Provider value={{
      lives, coins, totalXP, completedPhases, completedLessons, confidence, streak, lastLoginAt, loading,
      loseLife, addCoins, addXP, completeLesson, completePhase, updateConfidence,
      level, league, badges, dailyXP, dailyLessons, streakFreezeCount, xpBoostExpiresAt, buyItem, addBadge, spendCoins
    }}>
      {children}
    </UserProgressContext.Provider>
  );
};
