import { useState, useEffect, useRef } from "react";
import Player from "@vimeo/player";

interface WelcomeScreenProps {
  displayName: string;
  videoViews: number;
  onComplete: () => void;
}

export const WelcomeScreen = ({ displayName, videoViews, onComplete }: WelcomeScreenProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const isFirstView = videoViews === 0;

  useEffect(() => {
    if (!iframeRef.current) return;
    const player = new Player(iframeRef.current);

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
      onComplete();
    });

    return () => {
      player.off("timeupdate");
      player.off("ended");
    };
  }, [isFirstView, onComplete]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
      padding: "24px",
    }}>
      <div style={{
        maxWidth: 1100,
        width: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 48,
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {/* Video */}
        <div style={{
          flex: "1 1 500px",
          maxWidth: 640,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          position: "relative",
        }}>
          <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
            <iframe
              ref={iframeRef}
              src="https://player.vimeo.com/video/1170037067?badge=0&autopause=0&player_id=0&app_id=58479"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              title="Boas vindas"
            />
          </div>
          {/* Progress bar */}
          <div style={{
            height: 4,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 2,
          }}>
            <div style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>

        {/* Text */}
        <div style={{
          flex: "1 1 300px",
          maxWidth: 400,
          color: "white",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🚘</div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 800,
            marginBottom: 12,
            lineHeight: 1.2,
          }}>
            Bem vindo {displayName || "Motorista"}!
          </h1>
          <p style={{
            fontSize: "1.15rem",
            opacity: 0.85,
            lineHeight: 1.6,
            marginBottom: 32,
          }}>
            Agora começa a sua jornada de motorista de sucesso!
          </p>

          {canSkip && (
            <button
              onClick={onComplete}
              style={{
                padding: "14px 36px",
                fontSize: "1rem",
                fontWeight: 700,
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                color: "white",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Começar minha jornada →
            </button>
          )}

          {!canSkip && isFirstView && (
            <p style={{
              fontSize: "0.85rem",
              opacity: 0.5,
              fontStyle: "italic",
            }}>
              Assista pelo menos metade do vídeo para continuar...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
