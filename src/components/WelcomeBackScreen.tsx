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
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      opacity: show ? 1 : 0,
      transition: "opacity 0.5s ease",
    }}>
      <div style={{
        maxWidth: 420,
        width: "100%",
        textAlign: "center",
        color: "white",
      }}>
        <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🚘</div>

        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.8rem",
          fontWeight: 800,
          marginBottom: 8,
          lineHeight: 1.2,
        }}>
          Que bom te ver de volta, {displayName || "Motorista"}! 👋
        </h1>

        <p style={{
          fontSize: "1rem",
          opacity: 0.7,
          marginBottom: 40,
          lineHeight: 1.5,
        }}>
          O que deseja fazer agora?
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button
            onClick={onContinue}
            style={{
              padding: "16px 24px",
              fontSize: "1.05rem",
              fontWeight: 700,
              border: "none",
              borderRadius: 16,
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "white",
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(59,130,246,0.4)",
              transition: "transform 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            ▶ Continuar de onde parei
          </button>

          <button
            onClick={onWatchVideo}
            style={{
              padding: "16px 24px",
              fontSize: "1rem",
              fontWeight: 600,
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
              color: "white",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              e.currentTarget.style.transform = "scale(1.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            🎬 Assistir vídeo de boas-vindas
          </button>
        </div>
      </div>
    </div>
  );
};
