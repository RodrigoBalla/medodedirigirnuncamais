import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdmin } from "@/hooks/useAdmin";

export type AppTab = "home" | "treinos" | "ranking" | "comunidade" | "perfil";

interface AppLayoutProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
  displayName: string;
  totalXP: number;
  confidence: number;
  completedPhases: number;
  streakDays?: number;
}

const NAV_ITEMS: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "home", icon: "map", label: "Início" },
  { tab: "treinos", icon: "target", label: "Missões" },
  { tab: "ranking", icon: "trophy", label: "Ranking" },
  { tab: "comunidade", icon: "forum", label: "Social" },
  { tab: "perfil", icon: "person", label: "Perfil" },
];

const SIDEBAR_ITEMS: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "home", icon: "map", label: "Caminho Principal" },
  { tab: "treinos", icon: "target", label: "Missões Diárias" },
  { tab: "ranking", icon: "trophy", label: "Rankings" },
  { tab: "comunidade", icon: "forum", label: "Comunidade" },
];

function getLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1;
  const titles = ["Iniciante", "Aprendiz", "Praticante", "Intermediário", "Avançado", "Expert", "Mestre"];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { level, title, current: xp % 100, next: 100 };
}

export function AppLayout({
  activeTab,
  onTabChange,
  children,
  displayName,
  totalXP,
  confidence,
  completedPhases,
  streakDays = 1,
}: AppLayoutProps) {
  const { signOut } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { isAdmin } = useAdmin();
  const nav = useNavigate();
  const { level, title, current, next } = getLevel(totalXP);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6 py-2.5">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="size-9 flex items-center justify-center bg-destructive/10 rounded-xl">
            <span className="material-symbols-outlined text-destructive text-xl">minor_crash</span>
          </div>
          <h2 className="text-foreground text-sm md:text-base font-bold leading-tight tracking-tight hidden sm:block">
            Medo de dirigir nunca mais
          </h2>
        </div>

        {/* Right: Stats + Avatar */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Streak */}
          <div className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full border border-border">
            <span className="material-symbols-outlined text-orange-500 text-base filled-icon">local_fire_department</span>
            <span className="text-xs font-bold text-foreground">{streakDays} Dias</span>
          </div>
          {/* XP */}
          <div className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full border border-border">
            <span className="material-symbols-outlined text-primary text-base filled-icon">database</span>
            <span className="text-xs font-bold text-foreground">{totalXP}</span>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="size-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={isDark ? "Modo Claro" : "Modo Escuro"}
          >
            <span className="material-symbols-outlined text-lg">{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
          {/* Avatar */}
          <div className="size-9 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {displayName ? displayName.charAt(0).toUpperCase() : "?"}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card p-4 sticky top-[53px] h-[calc(100vh-53px)]">
          <div className="flex flex-col gap-6 h-full justify-between">
            <div className="flex flex-col gap-4">
              {/* Profile mini card */}
              <div className="flex items-center gap-3 px-3 py-3 bg-accent/50 rounded-xl border border-border">
                <div className="size-11 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{displayName || "Motorista"}</p>
                  <p className="text-[11px] text-muted-foreground">Nível {level} - {title}</p>
                  {/* XP Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(current / next) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-primary">{current}/{next}</span>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-1">
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => onTabChange(item.tab)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${
                      activeTab === item.tab
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl ${activeTab === item.tab ? "filled-icon" : ""}`}>
                      {item.icon}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </nav>

              {/* Pro upsell */}
              <div className="bg-gradient-to-br from-primary to-blue-700 rounded-xl p-4 text-primary-foreground">
                <p className="font-bold text-sm mb-1">Desbloqueie o Pro!</p>
                <p className="text-xs opacity-80 mb-3 leading-relaxed">Acesso ilimitado a simulados e revisões em vídeo.</p>
                <button className="w-full bg-primary-foreground text-primary font-bold text-xs py-2 rounded-lg hover:bg-primary-foreground/90 transition-colors">
                  Ver Planos
                </button>
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
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all font-medium"
              >
                <span className="material-symbols-outlined text-xl">{isDark ? "light_mode" : "dark_mode"}</span>
                <span className="text-sm">{isDark ? "Modo Claro" : "Modo Escuro"}</span>
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

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-1.5 flex justify-between items-center z-50 safe-area-bottom">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            onClick={() => onTabChange(item.tab)}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${
              activeTab === item.tab ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${activeTab === item.tab ? "filled-icon" : ""}`}>
              {item.icon}
            </span>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
