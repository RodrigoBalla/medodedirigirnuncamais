import { useEffect, useState } from "react";

interface WelcomeBackScreenProps {
  displayName: string;
  onWatchVideo: () => void;
  onContinue: () => void;
}

export const WelcomeBackScreen = ({ displayName, onWatchVideo, onContinue }: WelcomeBackScreenProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-gradient-to-br from-[hsl(var(--blue-900))] via-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] flex items-center justify-center p-6 transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}
    >
      <div className="max-w-[420px] w-full text-center text-primary-foreground">
        <div className="text-6xl mb-4">🚘</div>

        <h1 className="text-3xl font-extrabold leading-tight mb-2">
          Que bom te ver de volta, {displayName || "Motorista"}! 👋
        </h1>

        <p className="text-base opacity-70 mb-10 leading-relaxed">
          O que deseja fazer agora?
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2.5 py-4 px-6 text-lg font-bold rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:scale-[1.03] transition-transform"
          >
            ▶ Continuar de onde parei
          </button>

          <button
            onClick={onWatchVideo}
            className="flex items-center justify-center gap-2.5 py-4 px-6 text-base font-semibold rounded-2xl border-2 border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-sm text-primary-foreground hover:bg-primary-foreground/15 hover:scale-[1.03] transition-all"
          >
            🎬 Assistir vídeo de boas-vindas
          </button>
        </div>
      </div>
    </div>
  );
};
