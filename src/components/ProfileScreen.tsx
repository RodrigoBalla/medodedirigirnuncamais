import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { playCheckSound } from "@/lib/sounds";
import { CashbackCard } from "@/components/lms/CashbackCard";
import { AvatarUploader } from "@/components/AvatarUploader";
import { EditableDisplayName } from "@/components/EditableDisplayName";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useUserStats } from "@/hooks/useUserStats";
import { MissionsPanel } from "@/components/lms/MissionsPanel";
import { DailyWheelCard } from "@/components/lms/DailyWheelCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

// ─── Cor da Liga por nível ───────────────────────────────────────────────────
// Item 9 do diagnóstico: cor diferenciada por liga ajuda a percepção de progresso
function leagueStyle(league: string): { bg: string; text: string; emoji: string } {
  const l = (league || "").toLowerCase();
  if (l.includes("diamante") || l.includes("diamond"))
    return { bg: "bg-cyan-500/15 border-cyan-500/40", text: "text-cyan-700 dark:text-cyan-300", emoji: "💎" };
  if (l.includes("ouro") || l.includes("gold"))
    return { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-700 dark:text-amber-300", emoji: "🥇" };
  if (l.includes("prata") || l.includes("silver"))
    return { bg: "bg-slate-400/15 border-slate-400/40", text: "text-slate-700 dark:text-slate-300", emoji: "🥈" };
  // bronze (padrão)
  return { bg: "bg-orange-700/15 border-orange-700/40", text: "text-orange-800 dark:text-orange-300", emoji: "🥉" };
}

// "há X tempo" simples em PT-BR
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ProfileScreen({ displayName, totalXP, confidence: _confidence, completedPhases, totalPhases }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { league, badges, streakFreezeCount, xpBoostExpiresAt, streak, lives } = useUserProgress();
  // Nome vem do hook (sincronizado em tempo real com header/sidebar)
  const liveName = useDisplayName(displayName);
  // Stats reais (aulas concluídas, cursos liberados, dias estudando, última aula)
  const { lessonsCompleted, coursesUnlocked, daysStudied, lastLesson } = useUserStats();
  const progressPercent = Math.round((completedPhases / totalPhases) * 100);
  const [selectedBadge, setSelectedBadge] = useState<typeof ALL_BADGES[0] | null>(null);

  const isXpBoostActive = xpBoostExpiresAt && new Date(xpBoostExpiresAt) > new Date();
  const ligaStyle = leagueStyle(league);

  // Item 6: medalhas ordenadas — obtidas primeiro, depois bloqueadas
  const orderedBadges = useMemo(() => {
    return [...ALL_BADGES].sort((a, b) => {
      const ha = badges.includes(a.id) ? 0 : 1;
      const hb = badges.includes(b.id) ? 0 : 1;
      return ha - hb;
    });
  }, [badges]);

  // Item 10: email truncado pra não quebrar layout
  const displayEmail = useMemo(() => {
    const e = user?.email ?? "";
    if (e.length <= 24) return e;
    const [name, domain] = e.split("@");
    return `${name.slice(0, 8)}…@${domain}`;
  }, [user?.email]);

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

  // Item 11: confirmação no logout pra evitar toque acidental
  const handleSignOut = () => {
    if (confirm("Tem certeza que quer sair da conta?")) {
      signOut();
    }
  };

  // Item 5: CTA "Continue de onde parou"
  const handleContinueLesson = () => {
    if (lastLesson) {
      navigate(`/aula/${lastLesson.lesson_id}`);
    }
  };

  return (
    <div className="max-w-lg md:max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10 mb-20">

      {/* Item 2: h1 "Meu Perfil" — só em desktop, dá hierarquia */}
      <h1 className="hidden md:block font-black text-3xl md:text-4xl text-foreground mb-6 tracking-tight">
        Meu Perfil
      </h1>

      {/* Profile Header — avatar maior em desktop */}
      <div className="bg-card rounded-[32px] p-8 md:p-10 border border-border shadow-sm mb-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="mx-auto mb-4 w-fit">
          {/* Avatar maior em desktop pra preencher melhor o card */}
          <div className="md:hidden">
            <AvatarUploader displayName={liveName} size={96} />
          </div>
          <div className="hidden md:block">
            <AvatarUploader displayName={liveName} size={128} />
          </div>
        </div>
        <EditableDisplayName value={liveName} />
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
           {/* Item 9: Liga com cor por nível */}
           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${ligaStyle.bg} ${ligaStyle.text}`}>
             {ligaStyle.emoji} Liga {league}
           </span>
           {/* Item 10: email truncado, com title= mostrando o completo no hover */}
           <span
             className="text-xs text-muted-foreground font-medium opacity-70 truncate max-w-[180px]"
             title={user?.email}
           >
             {displayEmail}
           </span>
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

      {/* Item 5: "Continue de onde parou" — CTA grande pra retomar última aula */}
      {lastLesson && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleContinueLesson}
          className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/30 rounded-2xl p-4 md:p-5 mb-6 text-left flex items-center gap-4 hover:border-primary/50 transition-colors shadow-sm group"
        >
          <div className="size-12 md:size-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 border border-primary/30">
            <span className="material-symbols-outlined filled-icon text-primary text-2xl md:text-3xl">play_circle</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">
              ▶ Continue de onde parou
            </p>
            <p className="font-bold text-sm md:text-base truncate">{lastLesson.title}</p>
            <p className="text-[11px] text-muted-foreground">{timeAgo(lastLesson.updated_at)}</p>
          </div>
          <span className="material-symbols-outlined text-muted-foreground group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </motion.button>
      )}

      {/* Item 4: Stats grid com cor de fundo sutil + tamanho maior em desktop */}
      <div className="grid grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { icon: "school", value: lessonsCompleted, label: "Aulas", colorText: "text-primary", colorBg: "bg-primary/10 border-primary/20" },
          { icon: "library_books", value: coursesUnlocked, label: "Cursos", colorText: "text-blue-500", colorBg: "bg-blue-500/10 border-blue-500/20" },
          { icon: "local_fire_department", value: `${daysStudied}`, label: "Dias", colorText: "text-orange-500", colorBg: "bg-orange-500/10 border-orange-500/20" },
          { icon: "database", value: totalXP, label: "XP Total", colorText: "text-yellow-500", colorBg: "bg-yellow-500/10 border-yellow-500/20" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05, y: -2 }}
            className={`rounded-2xl p-3 md:p-4 border text-center shadow-sm cursor-default ${stat.colorBg}`}
          >
            <span className={`material-symbols-outlined ${stat.colorText} text-2xl md:text-3xl mb-0.5 filled-icon block`}>
              {stat.icon}
            </span>
            <p className="text-lg md:text-2xl font-black">{stat.value}</p>
            <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Roleta — seção full-width estilo LP */}
      <ErrorBoundary label="Roleta da Sorte">
        <DailyWheelCard />
      </ErrorBoundary>

      {/* Missões — seção full-width estilo LP */}
      <ErrorBoundary label="Missões">
        <MissionsPanel />
      </ErrorBoundary>

      {/* Badges (Medalhas) — Item 6: ordenadas + progress bar no topo */}
      <div className="bg-card rounded-[32px] p-6 md:p-7 border border-border shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
             <span className="material-symbols-outlined text-primary">military_tech</span>
             Coleção de Medalhas
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground">{badges.length}/{ALL_BADGES.length}</span>
        </div>

        {/* Progress da coleção */}
        <div className="mb-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(badges.length / ALL_BADGES.length) * 100}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {badges.length === ALL_BADGES.length
              ? "🏆 Coleção completa!"
              : badges.length === 0
                ? "Comece sua coleção completando desafios"
                : `Faltam ${ALL_BADGES.length - badges.length} pra coleção completa`}
          </p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {orderedBadges.map((b) => {
            const hasBadge = badges.includes(b.id);
            return (
              <motion.button
                key={b.id}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => handleBadgeClick(b)}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`size-14 md:size-16 rounded-2xl flex items-center justify-center border-2 shadow-sm transition-all ${hasBadge ? `bg-white dark:bg-card ${b.color} border-primary/20 shadow-lg` : 'bg-muted opacity-25 border-transparent grayscale'}`}>
                  <span className={`material-symbols-outlined text-2xl md:text-3xl ${hasBadge ? 'filled-icon' : ''}`}>{b.icon}</span>
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase text-center leading-tight opacity-70">{b.name}</span>
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

      {/* Mochila — seção full-width estilo LP. Item 12: inclui Vidas atuais */}
      <div className="bg-card rounded-[32px] p-6 md:p-7 border border-border shadow-sm mb-6">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
             <span className="material-symbols-outlined text-primary">backpack</span>
             Mochila de Itens
          </h3>
          <div className="space-y-3">
             {/* Vidas atuais — sempre visível */}
             <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-3">
                   <span className="material-symbols-outlined text-rose-500 filled-icon">favorite</span>
                   <div>
                      <p className="text-xs font-black uppercase">Vidas</p>
                      <p className="text-[10px] text-muted-foreground">
                        {lives >= 5 ? "Cheio · pronto pra estudar" : "Recarregam ao longo do dia"}
                      </p>
                   </div>
                </div>
                <span className="text-lg font-black text-rose-500">{lives}/5</span>
             </div>

             <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-3">
                   <span className="material-symbols-outlined text-blue-500 filled-icon">shield</span>
                   <div>
                      <p className="text-xs font-black uppercase">Escudo de Ofensiva</p>
                      <p className="text-[10px] text-muted-foreground">Protege seu recorde de {streak} dia{streak === 1 ? '' : 's'}</p>
                   </div>
                </div>
                <span className="text-lg font-black text-blue-500">{streakFreezeCount}</span>
             </div>

             <div className={`flex items-center justify-between p-3 rounded-xl border ${isXpBoostActive ? 'bg-purple-500/10 border-purple-500/20' : 'bg-accent/50 border-border opacity-60'}`}>
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

      {/* Cashback — seção full-width estilo LP. Moedas viram cupom de desconto */}
      <CashbackCard />

      {/* Settings — Item 11+13: confirmação no logout + ícone mais ameno */}
      <div className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-6 py-5 hover:bg-muted/50 transition-colors text-left text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined">door_back</span>
          <span className="font-bold text-sm uppercase tracking-tight">Sair da conta</span>
        </button>
      </div>
    </div>
  );
}
