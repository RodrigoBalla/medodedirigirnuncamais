import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { playCheckSound } from "@/lib/sounds";
import { CashbackCard } from "@/components/lms/CashbackCard";
import { AvatarUploader } from "@/components/AvatarUploader";
import { EditableDisplayName } from "@/components/EditableDisplayName";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useUserStats } from "@/hooks/useUserStats";
import { MissionsPanel } from "@/components/lms/MissionsPanel";

interface ProfileScreenProps {
  displayName: string;
  totalXP: number;
  confidence: number;
  completedPhases: number;
  totalPhases: number;
}

const ALL_BADGES = [
  { id: "primeiros_km", name: "Primeiros KM", icon: "tire_repair", color: "text-blue-500", description: "Atinja o Nível 2 para desbloquear." },
  { id: "motorista_corajoso", name: "Corajoso", icon: "electric_bolt", color: "text-yellow-500", description: "Complete todas as fases sem perder vidas." },
  { id: "mestre_ladeira", name: "Mestre da Ladeira", icon: "terrain", color: "text-green-500", description: "Complete o treino de Ladeira no Mapa." },
  { id: "rei_da_baliza", name: "Rei da Baliza", icon: "local_parking", color: "text-purple-500", description: "Complete o treino de Estacionamento." },
  { id: "olho_de_aguia", name: "Olho de Águia", icon: "visibility", color: "text-red-500", description: "Acerte 10 perguntas seguidas." },
  { id: "estudioso", name: "Estudioso", icon: "menu_book", color: "text-cyan-500", description: "Estude por 7 dias seguidos." },
];

export function ProfileScreen({ displayName, totalXP, confidence, completedPhases, totalPhases }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const { league, badges, streakFreezeCount, xpBoostExpiresAt, streak } = useUserProgress();
  // Nome vem do hook (sincronizado em tempo real com header/sidebar)
  const liveName = useDisplayName(displayName);
  // Stats reais (aulas concluídas, cursos liberados, dias estudando)
  const { lessonsCompleted, coursesUnlocked, daysStudied } = useUserStats();
  const progressPercent = Math.round((completedPhases / totalPhases) * 100);
  const [selectedBadge, setSelectedBadge] = useState<typeof ALL_BADGES[0] | null>(null);

  const isXpBoostActive = xpBoostExpiresAt && new Date(xpBoostExpiresAt) > new Date();

  const handleBadgeClick = (badge: typeof ALL_BADGES[0]) => {
    const hasBadge = badges.includes(badge.id);
    playCheckSound();
    setSelectedBadge(badge);
    if (hasBadge) {
      toast.success(`🏅 ${badge.name} — Desbloqueada!`);
    } else {
      toast(`🔒 ${badge.description}`, { icon: "💡" });
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 mb-20">
      {/* Profile Header */}
      <div className="bg-card rounded-[32px] p-8 border border-border shadow-sm mb-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="mx-auto mb-4 w-fit">
          <AvatarUploader displayName={liveName} size={96} />
        </div>
        <EditableDisplayName value={liveName} />
        <div className="flex items-center justify-center gap-2 mt-1">
           <span className="px-3 py-1 rounded-full bg-accent text-[10px] font-black uppercase tracking-widest border border-border">Liga {league}</span>
           <span className="text-xs text-muted-foreground font-medium opacity-70">{user?.email}</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 bg-muted rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-primary rounded-full"
          />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground mt-1">{progressPercent}% do curso completo</p>
      </div>

      {/* Stats Grid — métricas reais que o aluno afeta hoje:
          Aulas concluídas, Cursos comprados, Dias estudando, XP Total.
          (Removidos os antigos "Fases" e "Confiança" que dependiam das
           Missões Diárias bloqueadas com "Em breve") */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { icon: "school", value: lessonsCompleted, label: "Aulas", color: "text-primary" },
          { icon: "library_books", value: coursesUnlocked, label: "Cursos", color: "text-blue-500" },
          { icon: "local_fire_department", value: `${daysStudied}`, label: "Dias", color: "text-orange-500" },
          { icon: "database", value: totalXP, label: "XP Total", color: "text-yellow-500" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05 }}
            className="bg-card rounded-2xl p-3 border border-border text-center shadow-sm cursor-default"
          >
            <span className={`material-symbols-outlined ${stat.color} text-2xl mb-0.5 filled-icon`}>{stat.icon}</span>
            <p className="text-lg font-black">{stat.value}</p>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Painel de missões mensais — engajamento + retenção */}
      <MissionsPanel />

      {/* Badges (Medalhas) */}
      <div className="bg-card rounded-[32px] p-6 border border-border shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
             <span className="material-symbols-outlined text-primary">military_tech</span>
             Coleção de Medalhas
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground">{badges.length}/{ALL_BADGES.length}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {ALL_BADGES.map((b) => {
            const hasBadge = badges.includes(b.id);
            return (
              <motion.button
                key={b.id}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => handleBadgeClick(b)}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`size-14 rounded-2xl flex items-center justify-center border-2 shadow-sm transition-all ${hasBadge ? `bg-white dark:bg-card ${b.color} border-primary/20 shadow-lg` : 'bg-muted opacity-25 border-transparent grayscale'}`}>
                  <span className={`material-symbols-outlined text-2xl ${hasBadge ? 'filled-icon' : ''}`}>{b.icon}</span>
                </div>
                <span className="text-[9px] font-black uppercase text-center leading-tight opacity-70">{b.name}</span>
                {hasBadge && <span className="text-[8px] text-primary font-black">✓ OBTIDA</span>}
              </motion.button>
            );
          })}
        </div>

        {/* Badge Detail */}
        <AnimatePresence>
          {selectedBadge && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 rounded-2xl bg-accent/50 border border-border overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-3xl ${badges.includes(selectedBadge.id) ? selectedBadge.color + " filled-icon" : "text-muted-foreground"}`}>
                  {selectedBadge.icon}
                </span>
                <div>
                  <p className="font-black text-sm">{selectedBadge.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedBadge.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBadge(null)}
                className="text-[10px] font-bold text-primary mt-2 hover:underline"
              >
                Fechar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Backpack (Inventory) */}
      <div className="bg-card rounded-[32px] p-6 border border-border shadow-sm mb-6">
        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
           <span className="material-symbols-outlined text-primary">backpack</span>
           Mochila de Itens
        </h3>
        <div className="space-y-3">
           <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center gap-3">
                 <span className="material-symbols-outlined text-blue-500 filled-icon">shield</span>
                 <div>
                    <p className="text-xs font-black uppercase">Escudo de Ofensiva</p>
                    <p className="text-[10px] text-muted-foreground">Protege seu recorde</p>
                 </div>
              </div>
              <span className="text-lg font-black">{streakFreezeCount}</span>
           </div>
           <div className={`flex items-center justify-between p-3 rounded-xl border ${isXpBoostActive ? 'bg-purple-500/10 border-purple-500/20' : 'bg-accent/50 border-border opacity-50'}`}>
              <div className="flex items-center gap-3">
                 <span className={`material-symbols-outlined ${isXpBoostActive ? 'text-purple-500' : 'text-muted-foreground'} filled-icon`}>rocket_launch</span>
                 <div>
                    <p className="text-xs font-black uppercase">Turbo XP (2x)</p>
                    <p className="text-[10px] text-muted-foreground">{isXpBoostActive ? "Ativado no momento!" : "Inativo"}</p>
                 </div>
              </div>
              <span className="text-[10px] font-black uppercase">{isXpBoostActive ? "ON" : "OFF"}</span>
           </div>
        </div>
      </div>

      {/* Cashback — moedas viram cupom de desconto */}
      <CashbackCard />

      {/* Settings List — toggle de tema removido (mantemos só 1 modo). */}
      <div className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden">
        <button onClick={signOut} className="flex items-center gap-3 w-full px-6 py-5 hover:bg-destructive/5 transition-colors text-left text-destructive">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-bold text-sm uppercase tracking-tight">Sair da conta</span>
        </button>
      </div>
    </div>
  );
}
