import { useState, useEffect, useRef, useCallback } from "react";
import Player from "@vimeo/player";

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

    // Autoplay
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

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#000",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Video - full screen reels style */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ padding: "177.78% 0 0 0", position: "relative" }}>
          <iframe
            ref={iframeRef}
            src="https://player.vimeo.com/video/1170037067?badge=0&autopause=0&player_id=0&app_id=58479&controls=0&title=0&byline=0&portrait=0&autoplay=1&muted=0&background=0"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            title="Boas vindas"
          />
        </div>

        {/* Gradient overlays */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 240,
          background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
          pointerEvents: "none",
        }} />

        {/* Welcome text overlay - bottom left like reels */}
        <div style={{
          position: "absolute",
          bottom: 100,
          left: 20,
          right: 80,
          color: "white",
          zIndex: 10,
        }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            fontWeight: 800,
            marginBottom: 8,
            lineHeight: 1.2,
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}>
            Bem vindo {displayName || "Motorista"}! 🚘
          </h1>
          <p style={{
            fontSize: "1rem",
            opacity: 0.9,
            lineHeight: 1.5,
            textShadow: "0 1px 8px rgba(0,0,0,0.8)",
          }}>
            Agora começa a sua jornada de motorista de sucesso!
          </p>
        </div>

        {/* Right side controls like reels */}
        <div style={{
          position: "absolute",
          right: 16,
          bottom: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          zIndex: 10,
        }}>
          {/* Speed button */}
          <button
            onClick={cycleSpeed}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.3)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              color: "white",
              fontSize: "0.75rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            title="Velocidade do vídeo"
          >
            {speed}x
          </button>
        </div>

        {/* Progress bar at bottom */}
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.2)",
          zIndex: 10,
        }}>
          <div style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "white",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Skip / Continue button */}
        <div style={{
          position: "absolute",
          bottom: 12,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 10,
        }}>
          {canSkip ? (
            <button
              onClick={handleComplete}
              style={{
                padding: "12px 32px",
                fontSize: "0.95rem",
                fontWeight: 700,
                border: "none",
                borderRadius: 24,
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                color: "white",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(59,130,246,0.5)",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              Começar minha jornada →
            </button>
          ) : (
            <p style={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)",
              fontStyle: "italic",
              margin: 0,
            }}>
              Assista pelo menos metade do vídeo para continuar...
            </p>
          )}
        </div>

        {/* Initial play overlay */}
        {showOverlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.4)",
              zIndex: 20,
              cursor: "pointer",
            }}
            onClick={() => {
              playerRef.current?.play();
              setShowOverlay(false);
            }}
          >
            <div style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}>
              ▶
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
