import { useState, useEffect, useRef, useCallback } from "react";
import Player from "@vimeo/player";
import "@/styles/welcome-screen.css";

interface WelcomeScreenProps {
  displayName: string;
  videoViews: number;
  onComplete: () => void;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

export const WelcomeScreen = ({ displayName, videoViews, onComplete }: WelcomeScreenProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const isFirstView = videoViews === 0;

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!iframeRef.current) return;
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

    player.play().catch(() => {});

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

  /* ---- Phone mockup (the video container) ---- */
  const phoneMockup = (
    <div className="welcome-phone-mockup">
      {/* Phone frame - only visible on desktop */}
      <div className="welcome-phone-frame">
        {/* Notch */}
        <div className="welcome-phone-notch" />

        {/* Video area */}
        <div className="welcome-video-area">
          <div style={{ padding: "177.78% 0 0 0", position: "relative" }}>
            <iframe
              ref={iframeRef}
              src="https://player.vimeo.com/video/1170037067?badge=0&autopause=0&player_id=0&app_id=58479&controls=0&title=0&byline=0&portrait=0&autoplay=1&muted=0&background=0"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              title="Boas vindas"
            />
          </div>

          {/* Gradient overlays */}
          <div className="welcome-gradient-top" />
          <div className="welcome-gradient-bottom" />

          {/* Welcome text */}
          <div className="welcome-text-overlay">
            <h1 className="welcome-title">
              Bem vindo {displayName || "Motorista"}! 🚘
            </h1>
            <p className="welcome-subtitle">
              Agora começa a sua jornada de motorista de sucesso!
            </p>
          </div>

          {/* Speed control */}
          <div className="welcome-speed-area">
            <button onClick={cycleSpeed} className="welcome-speed-btn" title="Velocidade do vídeo">
              {speed}x
            </button>
          </div>

          {/* Progress bar */}
          <div className="welcome-progress-track">
            <div className="welcome-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>

          {/* Skip / Continue */}
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

          {/* Play overlay */}
          {showOverlay && (
            <div
              className="welcome-play-overlay"
              onClick={() => {
                playerRef.current?.play();
                setShowOverlay(false);
              }}
            >
              <div className="welcome-play-btn">▶</div>
            </div>
          )}
        </div>

        {/* Home indicator */}
        <div className="welcome-phone-home-indicator" />
      </div>
    </div>
  );

  /* ---- Right side panel (desktop only) ---- */
  const sidePanel = (
    <div className="welcome-side-panel">
      <div className="welcome-side-content">
        <div style={{ fontSize: "3rem", marginBottom: 12 }}>🚘</div>
        <h2 className="welcome-side-title">
          Sua jornada começa agora
        </h2>
        <p className="welcome-side-desc">
          Assista o vídeo de boas-vindas e descubra como superar o medo de dirigir de uma vez por todas.
        </p>
        <div className="welcome-side-features">
          <div className="welcome-feature-item">
            <span className="welcome-feature-icon">🎯</span>
            <span>Método comprovado e prático</span>
          </div>
          <div className="welcome-feature-item">
            <span className="welcome-feature-icon">💪</span>
            <span>Conquiste confiança ao volante</span>
          </div>
          <div className="welcome-feature-item">
            <span className="welcome-feature-icon">📈</span>
            <span>Acompanhe seu progresso</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="welcome-screen">
      {phoneMockup}
      {sidePanel}
    </div>
  );
};
