import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useUserProgress } from "@/contexts/UserProgressContext";

interface RankingScreenProps {
  displayName: string;
  totalXP: number;
}

const LEAGUES = {
  Bronze: { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", icon: "workspace_premium" },
  Prata: { color: "text-slate-300", bg: "bg-slate-300/10", border: "border-slate-300/20", icon: "military_tech" },
  Ouro: { color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", icon: "stars" },
  Diamante: { color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20", icon: "diamond" },
};

export function RankingScreen({ displayName, totalXP }: RankingScreenProps) {
  const { league, coins } = useUserProgress();
  const leagueInfo = LEAGUES[league as keyof typeof LEAGUES] || LEAGUES.Bronze;

  // Mock rankings — quando integrar com o banco, trocar por query agregando
  // todos os user_progress + profiles e ordenando por (total_xp DESC, coins DESC).
  // Critério de desempate: moedas. Empates de XP são resolvidos por quem
  // arrecadou mais moedas durante a temporada.
  const rankings = useMemo(() => {
    const baseXP = league === "Bronze" ? 0 : league === "Prata" ? 1000 : league === "Ouro" ? 2500 : 5000;
    return [
      { name: "Sarah J.",   xp: baseXP + 800, coins: 1820, avatar: "S" },
      { name: "Marco R.",   xp: baseXP + 650, coins: 1450, avatar: "M" },
      { name: "Leo K.",     xp: baseXP + 400, coins: 980,  avatar: "L" },
      // Julian e Elena empatados em XP — Elena fica acima por ter mais moedas.
      { name: "Julian P.",  xp: baseXP + 320, coins: 540,  avatar: "J" },
      { name: "Elena V.",   xp: baseXP + 320, coins: 720,  avatar: "E" },
      { name: "Thomas W.",  xp: baseXP + 150, coins: 410,  avatar: "T" },
      { name: "Mia K.",     xp: baseXP + 50,  coins: 120,  avatar: "K" },
    ].sort((a, b) => b.xp - a.xp || b.coins - a.coins);
  }, [league]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* League Header */}
      <div className={`mb-8 p-6 rounded-[32px] border ${leagueInfo.border} ${leagueInfo.bg} text-center relative overflow-hidden`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className={`material-symbols-outlined text-5xl mb-2 filled-icon ${leagueInfo.color}`}>
          {leagueInfo.icon}
        </span>
        <h2 className={`text-3xl font-black uppercase tracking-tighter italic ${leagueInfo.color}`}>
          Liga {league}
        </h2>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
          Faltam 4 dias para o fim da temporada
        </p>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-3 mb-10 px-4">
        {/* 2nd */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative mb-2">
            <div className="w-16 h-16 rounded-full border-4 border-slate-300 bg-slate-300/10 flex items-center justify-center text-xl font-bold">
              {rankings[1].avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-slate-300 text-slate-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs ring-4 ring-background">2</div>
          </div>
          <p className="font-bold text-xs">{rankings[1].name}</p>
          <p className="text-primary text-[10px] font-black uppercase tracking-tighter">{rankings[1].xp} XP</p>
          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-tighter flex items-center justify-center gap-0.5 mt-0.5">
            <span className="material-symbols-outlined text-[10px] filled-icon">database</span>
            {rankings[1].coins.toLocaleString()}
          </p>
          <div className="w-full mt-3 h-16 bg-gradient-to-t from-slate-300/20 to-transparent rounded-t-xl border-x border-t border-slate-300/30" />
        </div>

        {/* 1st */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative mb-3">
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500"
            >
              <span className="material-symbols-outlined filled-icon text-3xl">workspace_premium</span>
            </motion.div>
            <div className="w-20 h-20 rounded-full border-4 border-yellow-400 bg-yellow-400/10 flex items-center justify-center text-2xl font-bold shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              {rankings[0].avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm ring-4 ring-background">1</div>
          </div>
          <p className="font-black text-sm">{rankings[0].name}</p>
          <p className="text-yellow-500 text-xs font-black uppercase tracking-tighter">{rankings[0].xp} XP</p>
          <p className="text-yellow-500/90 text-[10px] font-black uppercase tracking-tighter flex items-center justify-center gap-0.5 mt-0.5">
            <span className="material-symbols-outlined text-[11px] filled-icon">database</span>
            {rankings[0].coins.toLocaleString()}
          </p>
          <div className="w-full mt-3 h-24 bg-gradient-to-t from-yellow-400/20 to-transparent rounded-t-xl border-x border-t border-yellow-400/30" />
        </div>

        {/* 3rd */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative mb-2">
            <div className="w-16 h-16 rounded-full border-4 border-orange-400 bg-orange-400/10 flex items-center justify-center text-xl font-bold">
              {rankings[2].avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-orange-400 text-orange-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs ring-4 ring-background">3</div>
          </div>
          <p className="font-bold text-xs">{rankings[2].name}</p>
          <p className="text-primary text-[10px] font-black uppercase tracking-tighter">{rankings[2].xp} XP</p>
          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-tighter flex items-center justify-center gap-0.5 mt-0.5">
            <span className="material-symbols-outlined text-[10px] filled-icon">database</span>
            {rankings[2].coins.toLocaleString()}
          </p>
          <div className="w-full mt-3 h-12 bg-gradient-to-t from-orange-400/20 to-transparent rounded-t-xl border-x border-t border-orange-400/30" />
        </div>
      </div>

      {/* List with Promotion Zone */}
      <div className="space-y-2 mb-4 transition-all">
        <div className="flex items-center justify-between px-2 mb-3">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Classificação</h3>
          <span className="text-[10px] font-bold text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">Zona de Promoção (+3)</span>
        </div>
        
        {rankings.slice(3).map((r, i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border shadow-sm hover:border-primary/40 transition-all group">
            <span className="w-6 text-center font-black text-muted-foreground italic">{i + 4}</span>
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              {r.avatar}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm uppercase tracking-tight">{r.name}</h4>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: '70%' }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Motorista</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-primary text-lg tabular-nums leading-none">{r.xp.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">XP Total</p>
              <p className="text-[10px] text-yellow-500 font-black tabular-nums flex items-center justify-end gap-0.5 mt-1">
                <span className="material-symbols-outlined text-[11px] filled-icon">database</span>
                {r.coins.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* User Floating Position */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
        <div className="flex items-center gap-4 p-5 rounded-[28px] bg-primary text-primary-foreground shadow-2xl shadow-primary/40 border-2 border-white/10">
          <span className="w-8 text-center font-black italic opacity-50">?</span>
          <div className="w-12 h-12 rounded-full border-2 border-white/30 bg-white/20 flex items-center justify-center font-black text-lg">
            {displayName ? displayName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex-1">
            <h4 className="font-black text-sm uppercase italic">{displayName || "Você"}</h4>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Sua Posição</span>
               <div className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-black uppercase">Fique no Top 3!</div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-2xl tabular-nums leading-none">{totalXP.toLocaleString()}</p>
            <p className="text-[9px] uppercase font-black tracking-widest opacity-60">XP Total</p>
            <p className="text-[10px] font-black tabular-nums flex items-center justify-end gap-0.5 mt-1 opacity-90">
              <span className="material-symbols-outlined text-[11px] filled-icon">database</span>
              {coins.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Legenda do critério de desempate */}
      <p className="text-center text-[10px] text-muted-foreground mb-24 font-medium">
        ℹ️ Em caso de empate de XP, vence quem tem mais <span className="text-yellow-500 font-bold">moedas</span>.
      </p>
    </div>
  );
}
