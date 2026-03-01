import { useState } from "react";
import type { Phase } from "@/data/driving-data";

interface ConquestScreenProps {
  phase: Phase;
  completedPhases: number[];
  onDashboard: () => void;
  onNextLesson: () => void;
  totalPhases: number;
  onEmotionSubmit: (tension: number, confidence: number) => void;
  phaseIndex: number;
}

export function ConquestScreen({
  phase,
  completedPhases,
  onDashboard,
  onNextLesson,
  totalPhases,
  onEmotionSubmit,
}: ConquestScreenProps) {
  const [showEmotion, setShowEmotion] = useState(false);
  const [tensionVal, setTensionVal] = useState<number | null>(null);
  const [confVal, setConfVal] = useState<number | null>(null);

  const confettiColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  if (showEmotion) {
    return (
      <div className="emotion-check" style={{ marginTop: 40 }}>
        <div className="emotion-title">Como você se sente agora? 💭</div>
        <div className="emotion-subtitle">
          Sua percepção emocional é parte do aprendizado. Responda com honestidade.
        </div>

        <div className="emotion-label">😰 Nível de tensão</div>
        <div className="emotion-scale">
          {[
            { emoji: "😌", label: "Nada" },
            { emoji: "😐", label: "Pouca" },
            { emoji: "😟", label: "Média" },
            { emoji: "😰", label: "Alta" },
            { emoji: "😱", label: "Muita" },
          ].map((item, i) => (
            <button
              key={i}
              className={`scale-btn ${tensionVal === i ? "sel" : ""}`}
              onClick={() => setTensionVal(i)}
            >
              {item.emoji}
              <span className="s-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="emotion-label">💪 Nível de confiança</div>
        <div className="emotion-scale">
          {[
            { emoji: "😟", label: "Nada" },
            { emoji: "😐", label: "Pouca" },
            { emoji: "🙂", label: "Média" },
            { emoji: "😊", label: "Alta" },
            { emoji: "🤩", label: "Total" },
          ].map((item, i) => (
            <button
              key={i}
              className={`scale-btn ${confVal === i ? "sel" : ""}`}
              onClick={() => setConfVal(i)}
            >
              {item.emoji}
              <span className="s-label">{item.label}</span>
            </button>
          ))}
        </div>

        <button
          className="btn-primary"
          disabled={tensionVal === null || confVal === null}
          onClick={() => {
            if (tensionVal !== null && confVal !== null) {
              onEmotionSubmit(tensionVal, confVal);
              setShowEmotion(false);
              onDashboard();
            }
          }}
        >
          Salvar e Continuar →
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: 400 }}>
      {/* Confetti */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", pointerEvents: "none", overflow: "hidden" }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: -20,
              left: `${Math.random() * 100}%`,
              width: 8,
              height: 8,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              background: confettiColors[i % confettiColors.length],
              animation: `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 1}s linear forwards`,
            }}
          />
        ))}
      </div>

      <div className="conquest-card">
        <div className="conquest-trophy" style={{ animation: "mascotBounce 1s ease-in-out" }}>
          🏆
        </div>
        <div className="conquest-stars">
          {"⭐".repeat(3)}
        </div>
        <div className="conquest-title">Fase Concluída!</div>
        <div className="conquest-msg">{phase.conquest}</div>
        <div style={{
          background: "rgba(255,255,255,0.15)",
          borderRadius: 16,
          padding: "12px 20px",
          marginBottom: 24,
          fontSize: "1.1rem",
          fontWeight: 800,
        }}>
          +{phase.xp} XP ganhos! ⚡
        </div>

        <button
          className="btn-primary"
          style={{ background: "white", color: "#1d4ed8" }}
          onClick={() => setShowEmotion(true)}
        >
          Como me sinto agora? 💭
        </button>

        {completedPhases.length < totalPhases ? (
          <button
            className="btn-secondary"
            style={{ borderColor: "hsl(var(--blue-300))", color: "hsl(var(--blue-800))", background: "white" }}
            onClick={onNextLesson}
          >
            Próxima Fase →
          </button>
        ) : (
          <button
            className="btn-secondary"
            style={{ borderColor: "hsl(var(--blue-300))", color: "hsl(var(--blue-800))", background: "white" }}
            onClick={onDashboard}
          >
            Voltar ao Dashboard 🏠
          </button>
        )}
      </div>
    </div>
  );
}
