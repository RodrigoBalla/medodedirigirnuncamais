import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";

export type AppTab = "home" | "treinos" | "ranking" | "comunidade" | "perfil";

interface AppLayoutProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
  displayName: string;
  totalXP: number;
  confidence: number;
  completedPhases: number;
}

const NAV_ITEMS: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "home", icon: "home", label: "Início" },
  { tab: "treinos", icon: "auto_stories", label: "Treinos" },
  { tab: "ranking", icon: "leaderboard", label: "Ranking" },
  { tab: "comunidade", icon: "forum", label: "Social" },
  { tab: "perfil", icon: "person", label: "Perfil" },
];

export function AppLayout({
  activeTab,
  onTabChange,
  children,
  displayName,
  totalXP,
  confidence,
  completedPhases,
}: AppLayoutProps) {
  const { signOut } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-10 py-3">
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary text-xl">directions_car</span>
          </div>
          <h2 className="text-foreground text-base md:text-lg font-bold leading-tight tracking-tight hidden sm:block">
            Medo de dirigir nunca mais
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats chips - scrollable on mobile */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
              <span className="material-symbols-outlined text-orange-500 text-base filled-icon">local_fire_department</span>
              <span className="text-sm font-bold">{completedPhases} Fases</span>
            </div>
            <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
              <span className="material-symbols-outlined text-yellow-500 text-base filled-icon">database</span>
              <span className="text-sm font-bold">{totalXP} XP</span>
            </div>
          </div>
          <div className="size-10 rounded-full border-2 border-primary/20 bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {displayName ? displayName.charAt(0).toUpperCase() : "?"}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card p-4 sticky top-[57px] h-[calc(100vh-57px)]">
          <div className="flex flex-col gap-8 h-full justify-between">
            <div className="flex flex-col gap-2">
              {/* Profile mini */}
              <div className="flex items-center gap-3 px-2 mb-4">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <p className="font-bold text-sm">{displayName || "Motorista"}</p>
                  <p className="text-xs text-muted-foreground">{totalXP} XP • Confiança {confidence}/5</p>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => onTabChange(item.tab)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${
                      activeTab === item.tab
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === item.tab ? "filled-icon" : ""}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Bottom actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all font-medium"
              >
                <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
                <span>{isDark ? "Modo Claro" : "Modo Escuro"}</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all font-medium"
              >
                <span className="material-symbols-outlined">logout</span>
                <span>Sair</span>
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
