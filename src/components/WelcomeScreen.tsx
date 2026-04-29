import { useState, useEffect, useRef, useCallback } from "react";
import Player from "@vimeo/player";
import { useTheme } from "@/contexts/ThemeContext";
import "@/styles/welcome-screen.css";

interface WelcomeScreenProps {
  displayName: string;
  videoViews: number;
  onComplete: () => void;
  onWatchVideo?: () => void;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

const isMobile = () => window.innerWidth <= 768;

export const WelcomeScreen = ({ displayName, videoViews, onComplete, onWatchVideo }: WelcomeScreenProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const isFirstView = videoViews === 0;

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const mobile = isMobile();
    const player = new Player(iframeRef.current);
    playerRef.current = player;

    if (!isFirstView) {
      setCanSkip(true);
    }

    player.on("timeupdate", (data: { percent: number }) => {
      setProgress(data.percent);
      if (isFirstView && data.percent >= 0.5) {
        setCanSkip(true);
      }
    });

    player.on("ended", () => {
      handleComplete();
    });

    player.on("play", () => {
      setShowOverlay(false);
    });

    if (mobile) {
      setIsMuted(true);
      player.setVolume(0).then(() => {
        player.play().catch(() => {});
      });
    } else {
      player.play().catch(() => {});
    }

    return () => {
      player.off("timeupdate");
      player.off("ended");
      player.off("play");
    };
  }, [isFirstView, handleComplete]);

  function cycleSpeed() {
    const currentIdx = SPEED_OPTIONS.indexOf(speed);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIdx];
    setSpeed(newSpeed);
    playerRef.current?.setPlaybackRate(newSpeed);
  }

  const firstName = displayName?.split(" ")[0] || "Motorista";

  /* ---- Phone mockup (the video container) — KEPT INTACT ---- */
  const phoneMockup = (
    <div className="welcome-phone-mockup">
      <div className="welcome-phone-frame">
        <div className="welcome-phone-notch" />
        <div className="welcome-video-area">
          <div style={{ padding: "177.78% 0 0 0", position: "relative" }}>
            <iframe
              ref={iframeRef}
              src="https://player.vimeo.com/video/1170037067?badge=0&autopause=0&player_id=0&app_id=58479&controls=0&title=0&byline=0&portrait=0&autoplay=1&muted=0&background=0&dnt=1&quality=auto"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="eager"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              title="Boas vindas"
            />
          </div>
          <div className="welcome-gradient-top" />
          <div className="welcome-gradient-bottom" />
          <div className="welcome-text-overlay">
            <h1 className="welcome-title">
              Bem vindo {firstName}! 🚘
            </h1>
            <p className="welcome-subtitle">
              Agora começa a sua jornada de motorista de sucesso!
            </p>
          </div>
          <div className="welcome-speed-area">
            <button onClick={cycleSpeed} className="welcome-speed-btn" title="Velocidade do vídeo">
              {speed}x
            </button>
          </div>
          <div className="welcome-progress-track">
            <div className="welcome-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="welcome-action-area">
            {canSkip ? (
              <button onClick={handleComplete} className="welcome-cta-btn">
                Começar minha jornada →
              </button>
            ) : (
              <p className="welcome-hint">
                Assista pelo menos metade do vídeo para continuar...
              </p>
            )}
          </div>
          {(showOverlay || isMuted) && (
            <div
              className="welcome-play-overlay"
              onClick={() => {
                if (playerRef.current) {
                  playerRef.current.setVolume(1);
                  playerRef.current.play();
                  setIsMuted(false);
                  setShowOverlay(false);
                }
              }}
            >
              <div className="welcome-play-btn">
                {isMuted && !showOverlay ? "🔊" : "▶"}
              </div>
              {isMuted && !showOverlay && (
                <p className="welcome-unmute-hint">Toque para ativar o som</p>
              )}
            </div>
          )}
        </div>
        <div className="welcome-phone-home-indicator" />
      </div>
    </div>
  );

  /* ---- Features data ---- */
  const features = [
    {
      icon: "verified",
      title: "Método comprovado e prático",
      desc: "Aulas estruturadas com foco em resultados rápidos e duradouros.",
    },
    {
      icon: "directions_car",
      title: "Conquiste confiança ao volante",
      desc: "Aprenda a lidar com o trânsito e sinta-se segura em qualquer situação.",
    },
    {
      icon: "trending_up",
      title: "Acompanhe seu progresso",
      desc: "Monitore cada etapa da sua evolução pessoal e celebre suas vitórias.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">steering_wheel_heat</span>
          <span className="font-bold text-foreground text-sm">Medo de Dirigir Nunca Mais</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="w-9 h-9 rounded-full flex items-center justify-center border border-border bg-card text-muted-foreground hover:bg-accent transition-colors">
            <span className="material-symbols-outlined text-xl">{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center bg-muted hover:bg-accent transition-colors">
            <span className="material-symbols-outlined text-muted-foreground text-xl">notifications</span>
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center bg-muted hover:bg-accent transition-colors">
            <span className="material-symbols-outlined text-muted-foreground text-xl">account_circle</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center gap-16 px-8 py-10 max-lg:flex-col max-lg:gap-8 max-lg:py-6">
        {/* Left: Phone mockup */}
        {phoneMockup}

        {/* Right: Info panel */}
        <div className="flex flex-col max-w-md max-lg:items-center max-lg:text-center">
          {/* Mentor badge */}
          <div className="flex items-center gap-3 mb-6 max-lg:justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">person</span>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Karla Margaretch</p>
              <p className="text-xs text-muted-foreground">Sua mentora</p>
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-extrabold text-foreground mb-1 leading-tight max-lg:text-2xl">
            Bem-vinda à sua liberdade
          </h2>
          <p className="text-primary font-bold text-lg mb-3">Sua jornada começa agora</p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Supere o medo de dirigir com um método focado na sua confiança e autonomia. Recupere o controle da sua vida e sinta o prazer de estar ao volante.
          </p>

          {/* Feature cards */}
          <div className="flex flex-col gap-4 mb-8 w-full">
            {features.map((f) => (
              <div key={f.icon} className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">{f.icon}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm mb-0.5">{f.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 w-full">
            {canSkip && (
              <button
                onClick={handleComplete}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity shadow-md"
              >
                Começar Agora
              </button>
            )}
            <button
              onClick={() => {
                if (playerRef.current) {
                  playerRef.current.play();
                  setShowOverlay(false);
                }
              }}
              className="w-full py-3.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-accent transition-colors"
            >
              Continuar assistindo
            </button>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          © 2026 Medo de Dirigir Nunca Mais. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};
