import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useAdmin } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";
import { ShopModal } from "@/components/lms/ShopModal";

export type AppTab = "home" | "treinos" | "ranking" | "comunidade" | "biblioteca" | "perfil";

// MVP: tabs/áreas bloqueadas com badge "Em Breve" — ainda visíveis na nav,
// mas não navegáveis. Quando o conteúdo dessas áreas estiver pronto, remover
// daqui para liberar.
const LOCKED_TABS: AppTab[] = ["home", "treinos", "ranking"];

interface AppLayoutProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
  displayName: string;
  confidence: number;
  completedPhases: number;
  streakDays?: number;
}

const NAV_ITEMS: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "perfil", icon: "person", label: "Perfil" },
  { tab: "biblioteca", icon: "video_library", label: "Cursos" },
  { tab: "home", icon: "map", label: "Trilha" },
  { tab: "treinos", icon: "target", label: "Missões" },
  { tab: "ranking", icon: "trophy", label: "Ranking" },
];

const SIDEBAR_ITEMS: { tab: AppTab; icon: string; label: string }[] = [
  // Itens ATIVOS no topo (usáveis hoje):
  { tab: "biblioteca", icon: "video_library", label: "Meus Cursos" },
  { tab: "comunidade", icon: "forum", label: "Comunidade" },
  // Itens BLOQUEADOS abaixo (Em breve):
  { tab: "home", icon: "map", label: "Trilha" },
  { tab: "treinos", icon: "target", label: "Missões Diárias" },
  { tab: "ranking", icon: "trophy", label: "Rankings" },
];

function getLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1;
  const titles = ["Iniciante", "Aprendiz", "Praticante", "Intermediário", "Avançado", "Expert", "Mestre"];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { level, title, current: xp % 100, next: 100 };
}

function getCarInfo(level: number) {
  if (level >= 30) return { icon: "sports_motorsports", name: "Supercarro", color: "bg-yellow-500/10 text-yellow-500", border: "border-yellow-500/30" };
  if (level >= 20) return { icon: "garage_car", name: "SUV Premium", color: "bg-cyan-500/10 text-cyan-500", border: "border-cyan-500/30" };
  if (level >= 10) return { icon: "local_taxi", name: "Sedan Moderno", color: "bg-blue-500/10 text-blue-500", border: "border-blue-500/30" };
  if (level >= 5) return { icon: "directions_car", name: "Hatch", color: "bg-green-500/10 text-green-500", border: "border-green-500/30" };
  return { icon: "minor_crash", name: "Fusca", color: "bg-destructive/10 text-destructive", border: "border-destructive/20" };
}

export function AppLayout({
  activeTab,
  onTabChange,
  children,
  displayName,
  confidence,
  completedPhases,
  streakDays = 1,
}: AppLayoutProps) {
  const { signOut } = useAuth();
  // Tema fixo em dark — sem necessidade de toggle

  const { isAdmin } = useAdmin();
  const nav = useNavigate();
  const { lives, coins, totalXP, streak, xpBoostExpiresAt } = useUserProgress();
  const { level, title, current, next } = getLevel(totalXP);
  const car = getCarInfo(level);
  const [showShop, setShowShop] = useState(false);

  const isXpBoostActive = xpBoostExpiresAt && new Date(xpBoostExpiresAt) > new Date();

  // MVP: clique em tab bloqueada exibe um aviso de "Em Breve" e não navega.
  const handleNavClick = (tab: AppTab) => {
    if (LOCKED_TABS.includes(tab)) {
      toast("🔒 Em breve!", {
        description: "Esta área ainda está em desenvolvimento.",
      });
      return;
    }
    onTabChange(tab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background asphalt-texture relative">
      {/* Fita de advertência fininha no topo absoluto da página — identidade trânsito */}
      <div className="caution-tape h-1.5 w-full" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6 py-2.5">
        {/* Left: Logo (MVP: leva para Meus Cursos, área principal) */}
        <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => nav("/biblioteca")} title={`Seu carro: ${car.name}`}>
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={`size-9 flex items-center justify-center rounded-xl border ${car.color} ${car.border} transition-colors`}
          >
            <span className="material-symbols-outlined text-xl">{car.icon}</span>
          </motion.div>
          <div className="hidden sm:block">
            <h2 className="text-foreground text-sm font-bold leading-tight tracking-tight">
              Medo de dirigir nunca mais
            </h2>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{car.name} • Nv.{level}</p>
          </div>
        </div>

        {/* Right: Stats + Avatar */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Vidas / Streak / Moedas — aparecem nas abas Missões, Perfil
              e Ranking (onde moedas é critério de desempate). Nas outras
              abas (Cursos, Trilha) ficam ocultos pra não poluir a UI. */}
          {(activeTab === "treinos" || activeTab === "perfil" || activeTab === "ranking") && (
            <>
              {/* Vidas ❤️ */}
              <motion.div
                id="onboarding-lives"
                whileHover={{ scale: 1.05 }}
                className={`flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full border border-border ${lives <= 1 ? 'animate-pulse border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
              >
                <span className={`material-symbols-outlined text-red-500 text-base filled-icon ${lives <= 1 ? 'animate-bounce' : ''}`}>favorite</span>
                <span className="text-xs font-black text-foreground">{lives}</span>
              </motion.div>

              {/* Streak ⚡ */}
              {streak > 0 && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/30 group cursor-help"
                  title={`${streak} dias seguidos! Não deixe o fogo apagar.`}
                >
                  <span className="material-symbols-outlined text-orange-500 text-base filled-icon animate-pulse group-hover:scale-125 transition-transform">local_fire_department</span>
                  <span className="text-xs font-black text-orange-600">{streak}</span>
                </motion.div>
              )}

              {/* Moedas 🪙 */}
              <motion.div
                id="onboarding-coins"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowShop(true)}
                className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full border border-border cursor-pointer group relative"
              >
                <span className="material-symbols-outlined text-yellow-500 text-base filled-icon group-hover:rotate-12 transition-transform">database</span>
                <span className="text-xs font-black text-foreground">{coins}</span>

                {isXpBoostActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 size-4 bg-purple-500 rounded-full border-2 border-background flex items-center justify-center"
                    title="XP Turbo Ativo!"
                  >
                    <span className="material-symbols-outlined text-[8px] text-white filled-icon">rocket_launch</span>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}

          {/* Admin button - only visible for admins */}
          {isAdmin && (
            <button
              onClick={() => nav("/admin")}
              className="size-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Painel Admin"
            >
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            </button>
          )}
          {/* Avatar */}
          <div className="size-9 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {displayName ? displayName.charAt(0).toUpperCase() : "?"}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar — fundo preto puro como detalhe da paleta (navy + amarelo + preto)
            + fita de advertência vertical fina na borda direita pra reforçar identidade trânsito */}
        <aside className="hidden lg:flex flex-col w-64 bg-black p-4 sticky top-[53px] h-[calc(100vh-53px)] relative">
          <div className="caution-tape--vertical absolute top-0 right-0 bottom-0 w-1.5" aria-hidden="true" />
          <div className="flex flex-col gap-6 h-full justify-between">
            <div className="flex flex-col gap-4">
              {/* Profile mini card — fundo levemente clareado pra destacar do preto */}
              <div className="flex items-center gap-3 px-3 py-3 bg-white/5 rounded-xl border border-white/10">
                <div className="size-11 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{displayName || "Motorista"}</p>
                  <p className="text-[11px] text-muted-foreground">Nível {level} - {title}</p>
                  {/* XP Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(current / next) * 100}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        className="h-full bg-primary rounded-full" 
                      />
                    </div>
                    <span className="text-[10px] font-bold text-primary">{current}/{next}</span>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-1">
                {SIDEBAR_ITEMS.map((item) => {
                  const isLocked = LOCKED_TABS.includes(item.tab);
                  return (
                    <button
                      key={item.tab}
                      onClick={() => handleNavClick(item.tab)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${
                        activeTab === item.tab
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : isLocked
                          ? "text-muted-foreground/60 hover:bg-accent/50 cursor-not-allowed"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${activeTab === item.tab ? "filled-icon" : ""}`}>
                        {isLocked ? "lock" : item.icon}
                      </span>
                      <span className="text-sm flex-1">{item.label}</span>
                      {isLocked && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30">
                          Em breve
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Pro upsell — embrulhado em fitas de advertência (identidade trânsito) */}
              <div className="rounded-xl overflow-hidden">
                <div className="caution-tape h-2" aria-hidden="true" />
                <div className="bg-gradient-to-br from-primary to-yellow-500 p-4 text-primary-foreground">
                  <p className="font-black text-sm mb-1 uppercase tracking-wider">Desbloqueie o Pro!</p>
                  <p className="text-xs opacity-90 mb-3 leading-relaxed">Acesso ilimitado a simulados e revisões em vídeo.</p>
                  <button
                    onClick={() => setShowShop(true)}
                    className="w-full bg-black text-primary font-black text-xs py-2.5 rounded-lg hover:bg-black/85 transition-colors uppercase tracking-widest"
                  >
                    Ver Planos
                  </button>
                </div>
                <div className="caution-tape h-2" aria-hidden="true" />
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onTabChange("perfil")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${
                  activeTab === "perfil"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className="material-symbols-outlined text-xl">person</span>
                <span className="text-sm">Perfil</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all font-medium"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                <span className="text-sm">Sair</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 pb-20 lg:pb-0 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Shop Modal */}
      <ShopModal isOpen={showShop} onClose={() => setShowShop(false)} />

      {/* Mobile Bottom Navigation — fita de advertência fininha logo acima */}
      <div className="caution-tape lg:hidden fixed bottom-[70px] left-0 right-0 h-1 z-50" aria-hidden="true" />
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 px-2 py-1.5 flex justify-between items-center z-50 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const isLocked = LOCKED_TABS.includes(item.tab);
          return (
            <button
              key={item.tab}
              onClick={() => handleNavClick(item.tab)}
              className={`relative flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${
                activeTab === item.tab
                  ? "text-primary"
                  : isLocked
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground"
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${activeTab === item.tab ? "filled-icon" : ""}`}>
                {isLocked ? "lock" : item.icon}
              </span>
              <span className="text-[10px] font-bold">{item.label}</span>
              {isLocked && (
                <span className="absolute -top-1 right-1/2 translate-x-[26px] text-[7px] font-black uppercase tracking-widest bg-amber-500/90 text-white px-1 py-px rounded-sm leading-none">
                  Em breve
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
