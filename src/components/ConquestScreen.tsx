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
      <div className="mt-10">
        <h2 className="text-xl font-bold text-center mb-2">Como você se sente agora? 💭</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Sua percepção emocional é parte do aprendizado. Responda com honestidade.
        </p>

        <p className="text-sm font-bold text-muted-foreground mb-2">😰 Nível de tensão</p>
        <div className="flex gap-2 mb-6">
          {[
            { emoji: "😌", label: "Nada" },
            { emoji: "😐", label: "Pouca" },
            { emoji: "😟", label: "Média" },
            { emoji: "😰", label: "Alta" },
            { emoji: "😱", label: "Muita" },
          ].map((item, i) => (
            <button
              key={i}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                tensionVal === i
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
              onClick={() => setTensionVal(i)}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        <p className="text-sm font-bold text-muted-foreground mb-2">💪 Nível de confiança</p>
        <div className="flex gap-2 mb-6">
          {[
            { emoji: "😟", label: "Nada" },
            { emoji: "😐", label: "Pouca" },
            { emoji: "🙂", label: "Média" },
            { emoji: "😊", label: "Alta" },
            { emoji: "🤩", label: "Total" },
          ].map((item, i) => (
            <button
              key={i}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                confVal === i
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
              onClick={() => setConfVal(i)}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        <button
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="relative overflow-hidden min-h-[400px]">
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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

      <div className="relative z-10 bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-8 text-center text-primary-foreground shadow-xl">
        <div className="text-6xl mb-4" style={{ animation: "mascotBounce 1s ease-in-out" }}>🏆</div>
        <div className="text-3xl mb-2">⭐⭐⭐</div>
        <h2 className="text-2xl font-bold mb-2">Fase Concluída!</h2>
        <p className="text-sm opacity-90 mb-4">{phase.conquest}</p>
        <div className="bg-primary-foreground/15 rounded-2xl py-3 px-5 mb-6 text-lg font-extrabold inline-block">
          +{phase.xp} XP ganhos! ⚡
        </div>

        <div className="flex flex-col gap-3">
          <button
            className="w-full bg-card text-primary font-bold py-3.5 rounded-xl hover:bg-card/90 transition-colors shadow-md"
            onClick={() => setShowEmotion(true)}
          >
            Como me sinto agora? 💭
          </button>

          {completedPhases.length < totalPhases ? (
            <button
              className="w-full bg-primary-foreground/20 text-primary-foreground border-2 border-primary-foreground/30 font-bold py-3 rounded-xl hover:bg-primary-foreground/30 transition-colors"
              onClick={onNextLesson}
            >
              Próxima Fase →
            </button>
          ) : (
            <button
              className="w-full bg-primary-foreground/20 text-primary-foreground border-2 border-primary-foreground/30 font-bold py-3 rounded-xl hover:bg-primary-foreground/30 transition-colors"
              onClick={onDashboard}
            >
              Voltar ao Dashboard 🏠
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
