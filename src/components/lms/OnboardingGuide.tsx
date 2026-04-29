import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface OnboardingProps {
  onComplete: () => void;
  lessonScreen: string;
  lessonStep: number;
  quizAnswered: boolean;
}

interface OnboardingStep {
  targetId: string;
  title: string;
  description: string;
  icon: string;
  position: "top" | "bottom" | "left" | "right";
  showNextBtn: boolean;
}

export function OnboardingGuide({ onComplete, lessonScreen, lessonStep, quizAnswered }: OnboardingProps) {
  const [dashboardStep, setDashboardStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  
  // Dashboard static steps
  const DASHBOARD_STEPS: OnboardingStep[] = [
    { targetId: "onboarding-lives", title: "Suas Vidas ❤️", description: "Cada erro grave te custa 1 vida. Fique atento!", icon: "favorite", position: "bottom", showNextBtn: true },
    { targetId: "onboarding-coins", title: "Suas Moedas 🪙", description: "Use moedas na Loja para recuperar vidas e dar aquele gás.", icon: "paid", position: "bottom", showNextBtn: true },
    { targetId: "onboarding-daily-bonus", title: "Bônus Diário 🔥", description: "Recompensas diárias por manter o foco nos treinos.", icon: "calendar_month", position: "bottom", showNextBtn: true },
    { targetId: "onboarding-first-lesson", title: "Sua Missão 1 🚗", description: "Toque aqui para começar o treinamento obrigatório!", icon: "directions_car", position: "bottom", showNextBtn: false },
  ];

  // Determine current active step based on external global app state
  const getCurrentStep = (): OnboardingStep | null => {
    // 1. Em Dashboard
    if (lessonScreen === "none") {
      return DASHBOARD_STEPS[dashboardStep] || DASHBOARD_STEPS[3];
    }
    // 2. Dentro de uma Lição
    if (lessonScreen === "lesson") {
      // Step 0: Intro (Começar Missão)
      if (lessonStep === 0) {
        return { targetId: "onboarding-start-mission", title: "Dar a Partida", description: "Leia o objetivo e clique no botão para pular pra ação.", icon: "sports_score", position: "top", showNextBtn: false };
      }
      // Step 1: Quiz (Escolha a resposta, Confirme, Avance)
      if (lessonStep === 1) {
        if (document.getElementById("onboarding-confirm-sure")) {
           return { targetId: "onboarding-confirm-sure", title: "Trave sua Resposta", description: "Isso te dá os pontos. Vamos lá!", icon: "check_circle", position: "top", showNextBtn: false };
        }
        if (quizAnswered) {
           return { targetId: "onboarding-next-quiz", title: "Boa! Avançar.", description: "Você acertou! Pule para a próxima fase.", icon: "arrow_forward", position: "top", showNextBtn: false };
        }
        return { targetId: "onboarding-quiz-correct", title: "Cuidado na Escolha", description: "Você precisa acertar a pergunta. Tente escolher a cor Certa (Ou a primeira).", icon: "help", position: "top", showNextBtn: false };
      }
      // Step 2: Simulação Mental
      if (lessonStep === 2) {
        return { targetId: "onboarding-sim-next", title: "Vamos a Prática", description: "Feche os olhos, visualize o movimento, e siga em frente.", icon: "self_improvement", position: "top", showNextBtn: false };
      }
      // Step 3: Tarefas e Finalização
      if (lessonStep === 3) {
        if (document.getElementById("onboarding-finish-btn") && !(document.getElementById("onboarding-finish-btn") as HTMLButtonElement).disabled) {
           return { targetId: "onboarding-finish-btn", title: "Vitória!", description: "Você cumpriu a missão. Aperte para celebrar!", icon: "rocket_launch", position: "top", showNextBtn: false };
        }
        return { targetId: "onboarding-task-list", title: "Cumpra os Requisitos", description: "Clique em cada tarefa conforme conclui no carro e libere o sucesso.", icon: "checklist", position: "top", showNextBtn: false };
      }
    }
    // 3. Tela de Conquista Final
    if (lessonScreen === "conquest") {
      // If the chest is no longer in the DOM, they've claimed the reward!
      if (!document.getElementById("onboarding-collect-reward")) {
        // Wait briefly for the chest animation before completing
        setTimeout(() => onComplete(), 800);
        return null;
      }
      return { targetId: "onboarding-collect-reward", title: "Colha os Frutos!", description: "Você completou seu treinamento. Toque no baú para pegar o XP!", icon: "emoji_events", position: "top", showNextBtn: false };
    }
    return null;
  };

  const currentStep = getCurrentStep();

  // Position calculation
  const calculatePosition = useCallback(() => {
    if (!currentStep) return;
    const el = document.getElementById(currentStep.targetId);
    if (!el) {
      setSpotlightRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setSpotlightRect(rect);

    const padding = 20;
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    let style: React.CSSProperties = { width: tooltipWidth };

    switch (currentStep.position) {
      case "bottom":
        style.top = rect.bottom + padding;
        style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
        break;
      case "top":
        style.bottom = window.innerHeight - rect.top + padding;
        style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
        break;
    }

    setTooltipStyle(style);
  }, [currentStep]);

  // Recalculate periodically to catch elements entering the DOM quickly
  useEffect(() => {
    const timer = setInterval(() => calculatePosition(), 200);
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
    };
  }, [calculatePosition]);

  if (!currentStep) return null;

  const pad = 12;
  const cutout = spotlightRect
    ? {
        x: spotlightRect.left - pad,
        y: spotlightRect.top - pad,
        w: spotlightRect.width + pad * 2,
        h: spotlightRect.height + pad * 2,
        rx: 16,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[1000]" style={{ pointerEvents: "none" }}>
      {/* Dim overlay with SVG Hole */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {cutout && (
              <rect x={cutout.x} y={cutout.y} width={cutout.w} height={cutout.h} rx={cutout.rx} fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#onboarding-mask)" />
      </svg>

      {/* Highlighter Ring around target */}
      {cutout && (
        <motion.div
          key={currentStep.targetId}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute pointer-events-none z-10"
          style={{
            left: cutout.x - 4, top: cutout.y - 4, width: cutout.w + 8, height: cutout.h + 8,
            borderRadius: cutout.rx + 4, border: "3px solid hsl(var(--primary))",
            boxShadow: "0 0 25px hsl(var(--primary) / 0.6), inset 0 0 15px hsl(var(--primary) / 0.3)",
          }}
        />
      )}

      {/* 4 Blockers to prevent clicks anywhere EXCEPT within the cutout gap */}
      {cutout && (
        <>
          <div className="absolute top-0 left-0 right-0 opacity-0 bg-red-500" style={{ height: Math.max(0, cutout.y), pointerEvents: "auto" }} onClick={e=>e.stopPropagation()} />
          <div className="absolute left-0 opacity-0 bg-green-500" style={{ top: cutout.y, height: cutout.h, width: Math.max(0, cutout.x), pointerEvents: "auto" }} onClick={e=>e.stopPropagation()} />
          <div className="absolute right-0 opacity-0 bg-blue-500" style={{ top: cutout.y, height: cutout.h, width: Math.max(0, window.innerWidth - (cutout.x + cutout.w)), pointerEvents: "auto" }} onClick={e=>e.stopPropagation()} />
          <div className="absolute bottom-0 left-0 right-0 opacity-0 bg-yellow-500" style={{ height: Math.max(0, window.innerHeight - (cutout.y + cutout.h)), pointerEvents: "auto" }} onClick={e=>e.stopPropagation()} />
        </>
      )}

      {/* Default Overlay Blocker if element hasn't loaded yet */}
      {!cutout && (
        <div className="absolute inset-0 opacity-0" style={{ pointerEvents: "auto" }} onClick={e=>e.stopPropagation()} />
      )}

      {/* Tooltip Float */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.targetId}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="absolute z-50 shadow-2xl shadow-black/50"
          style={{ ...tooltipStyle, pointerEvents: "auto" }}
        >
          <div className="bg-card border-2 border-primary/20 rounded-3xl p-5 relative overflow-hidden">
             {/* Neon glow inside card */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-primary blur-md" />
            
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-3xl filled-icon animate-pulse">{currentStep.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-lg tracking-tight mb-1">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{currentStep.description}</p>
              </div>
            </div>

            {currentStep.showNextBtn && (
              <button
                onClick={() => setDashboardStep(s => s + 1)}
                className="w-full mt-5 py-3 rounded-xl bg-primary text-primary-foreground font-black uppercase text-sm tracking-widest hover:bg-primary/90 transition-all flex justify-center items-center gap-2"
              >
                Próximo <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}
            
            {!currentStep.showNextBtn && (
              <p className="mt-5 text-center text-xs font-bold text-primary animate-pulse tracking-widest uppercase">
                Toque na região destacada!
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
