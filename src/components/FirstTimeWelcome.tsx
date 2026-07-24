import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

// ─── FirstTimeWelcome ────────────────────────────────────────────────────────
// Tour guiado MUITO simples que aparece SÓ na primeiríssima entrada da aluna
// na área de membros. Marca no localStorage pra nunca mais aparecer.
//
// Princípios:
//  - Telas grandes, 1 ideia por card (cabe na cabeça de quem tem 5 anos)
//  - Linguagem da Carla, calorosa, sem termos técnicos
//  - 1 botão por vez ("Próximo") — sem opções pra confundir
//  - Pode pular a qualquer momento (X no canto)
//  - Mobile-first: todo o layout otimizado pra 390px
//
// Trigger:
//  - localStorage["mddnm:first_welcome_done"] !== "1"
//  - Pode ser resetado por: localStorage.removeItem("mddnm:first_welcome_done")
// =============================================================================

const STORAGE_KEY = "mddnm:first_welcome_done";

interface Step {
  emoji: string;
  title: string;
  body: string;
  color: string;
  icon?: string;
}

function buildSteps(firstName: string): Step[] {
  return [
    {
      emoji: "👋",
      title: `Oi, ${firstName}!`,
      body:
        "Sou a Carla, vou te acompanhar nessa jornada. Em 30 segundos eu te mostro como tudo funciona aqui. Bora?",
      color: "from-primary/30 to-primary/5",
      icon: "waving_hand",
    },
    {
      emoji: "🎬",
      title: "Onde está o curso que você comprou",
      body:
        "Em MEUS CURSOS. Toque na capa do curso, escolha a aula e dê play. Pode pausar, voltar e assistir quantas vezes quiser — ele já volta de onde você parou. É seu, no seu ritmo.",
      color: "from-blue-500/30 to-blue-500/5",
      icon: "video_library",
    },
    {
      emoji: "🎯",
      title: "As MISSÕES valem moedas",
      body:
        "No seu PERFIL tem missões simples (assistir uma aula, praticar, postar). Toque em “Fiz isso” ou “Resgatar” e as moedas caem na sua conta. Elas viram desconto nos próximos cursos.",
      color: "from-orange-500/30 to-orange-500/5",
      icon: "target",
    },
    {
      emoji: "⭐",
      title: "Seu NÍVEL sobe junto",
      body:
        "Todo mundo começa no Nível 1. Conforme você faz missões e junta moedas, vai subindo — são 33 níveis até virar Lenda do Volante. Sem pressa e sem cobrança.",
      color: "from-yellow-500/30 to-yellow-500/5",
      icon: "workspace_premium",
    },
    {
      emoji: "💬",
      title: "Precisou de ajuda? Me chama",
      body:
        "Vê aquele botão amarelo redondo no canto da tela? É o meu chat. Toque nele e me manda a dúvida — eu respondo por ali mesmo. Também tem a COMUNIDADE, pra trocar ideia com outras alunas.",
      color: "from-purple-500/30 to-purple-500/5",
      icon: "support_agent",
    },
    {
      emoji: "🚗💨",
      title: "Pronta!",
      body:
        "Sua primeira missão é simples: assiste a Aula 00 — Apresentação do módulo. Depois disso você decide o ritmo. Bora começar?",
      color: "from-green-500/30 to-green-500/5",
      icon: "rocket_launch",
    },
  ];
}

interface Props {
  /** Nome de exibição da aluna (sem .toUpperCase, primeiro nome basta) */
  displayName?: string;
  /** Forçar exibição (útil pro admin testar) */
  force?: boolean;
}

export function FirstTimeWelcome({ displayName, force = false }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    if (force) {
      setOpen(true);
      return;
    }
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        // Pequeno delay pra render do app terminar primeiro
        const t = setTimeout(() => setOpen(true), 700);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignora — localStorage pode estar bloqueado (modo privado) */
    }
  }, [user?.id, force]);

  function complete() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ok */
    }
    setOpen(false);
  }

  const firstName = (displayName || "aluna").trim().split(/\s+/)[0] || "aluna";
  const steps = buildSteps(firstName);
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const progress = ((stepIdx + 1) / steps.length) * 100;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
        onClick={(e) => {
          // Não fecha clicando fora — só pelo X ou "Pronta!" no fim
          if (e.target === e.currentTarget) e.stopPropagation();
        }}
      >
        <motion.div
          key={stepIdx}
          initial={{ y: 30, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden relative"
        >
          {/* Botão pular no canto */}
          <button
            onClick={complete}
            aria-label="Pular apresentação"
            className="absolute top-3 right-3 size-9 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center z-10 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          {/* Barra de progresso topo */}
          <div className="h-1.5 bg-muted/30 w-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            />
          </div>

          {/* Conteúdo do step */}
          <div className={`bg-gradient-to-br ${step.color}`}>
            <div className="p-6 sm:p-8 pt-10 pb-6 text-center">
              <motion.div
                key={`emoji-${stepIdx}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="text-6xl sm:text-7xl mb-4 leading-none"
              >
                {step.emoji}
              </motion.div>
              <motion.h2
                key={`title-${stepIdx}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.18 }}
                className="text-2xl sm:text-3xl font-black leading-tight tracking-tight mb-3"
                style={{ textWrap: "balance" }}
              >
                {step.title}
              </motion.h2>
              <motion.p
                key={`body-${stepIdx}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.26 }}
                className="text-base sm:text-lg text-muted-foreground leading-relaxed"
                style={{ textWrap: "balance" }}
              >
                {step.body}
              </motion.p>
            </div>
          </div>

          {/* Footer com botões — grandes pra mobile (44px+ de altura) */}
          <div className="p-5 sm:p-6 bg-card flex items-center gap-3">
            {stepIdx > 0 && (
              <button
                onClick={() => setStepIdx((i) => i - 1)}
                className="size-12 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Voltar"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) complete();
                else setStepIdx((i) => i + 1);
              }}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isLast ? (
                <>
                  <span className="material-symbols-outlined text-base">play_arrow</span>
                  Bora dirigir!
                </>
              ) : (
                <>
                  Próximo
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>

          {/* Indicador de step (dots) */}
          <div className="flex items-center justify-center gap-1.5 pb-5 bg-card">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIdx
                    ? "w-6 bg-primary"
                    : i < stepIdx
                    ? "w-1.5 bg-primary/60"
                    : "w-1.5 bg-muted/40"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
