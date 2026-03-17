import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface WelcomeBackScreenProps {
  displayName: string;
  onWatchVideo: () => void;
  onContinue: () => void;
  progressPercent?: number;
}

export const WelcomeBackScreen = ({
  displayName,
  onWatchVideo,
  onContinue,
  progressPercent = 65,
}: WelcomeBackScreenProps) => {
  const [show, setShow] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"} bg-background`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="size-9 flex items-center justify-center bg-primary/10 rounded-xl">
            <span className="material-symbols-outlined text-primary text-xl">directions_car</span>
          </div>
          <h2 className="text-foreground text-sm md:text-base font-bold tracking-tight hidden sm:block">
            Medo de dirigir nunca mais
          </h2>
        </div>
        <button className="relative size-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <span className="material-symbols-outlined text-lg">notifications</span>
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="size-20 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">directions_car</span>
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight mb-2">
              Que bom te ver de volta, {displayName || "Motorista"}! 👋
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              O que deseja fazer agora?
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 mb-8">
            <button
              onClick={onContinue}
              className="flex items-center justify-center gap-3 py-4 px-6 text-base font-bold rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all"
            >
              <span className="material-symbols-outlined text-xl filled-icon">play_circle</span>
              Continuar de onde parei
            </button>

            <button
              onClick={onWatchVideo}
              className="flex items-center justify-center gap-3 py-4 px-6 text-base font-semibold rounded-2xl border-2 border-border bg-card text-foreground hover:bg-accent hover:scale-[1.02] transition-all"
            >
              <span className="material-symbols-outlined text-xl">video_library</span>
              Assistir vídeo de boas-vindas
            </button>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Progresso</p>
              <p className="text-2xl font-extrabold text-primary">{progressPercent}%</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
              <p className="text-2xl font-extrabold text-foreground">Membro</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">
          © 2024 Medo de dirigir nunca mais. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};
