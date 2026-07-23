import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { flyCoins } from "@/lib/coinFly";

// Recompensa em moedas por TIPO de tarefa (cada tarefa tem a sua).
// Prefixo do id do passo (practice/lesson/mission) → moedas. Total da semana = 50.
const STEP_REWARDS: Record<string, number> = { practice: 20, lesson: 15, mission: 15 };
const rewardForStep = (id: string): number => STEP_REWARDS[id.split("-")[0]] ?? 15;

// ─── WeeklyPlanCard ──────────────────────────────────────────────────────────
// Card no topo da biblioteca: "Esta semana você vai..."
// Mostra 3 micro-objetivos (1 prática, 1 aula, 1 missão) pra reduzir
// fricção de decisão. Quem tem ansiedade já cansa de DECIDIR o que fazer.
//
// O plano é gerado deterministicamente pelo número da semana ISO, então
// todas as alunas no mesmo período veem o mesmo conjunto. Renova segunda
// (00:00 horário local). Marcar como feito persiste em localStorage por
// user (chave inclui userId + week_id) pra check ficar entre sessões.
//
// Ao CONCLUIR cada tarefa: dispara a animação de moedas subindo pro saldo
// (a recompensa daquela tarefa), credita as moedas e a tarefa SOME da lista.
// Quando todas somem, mostra "🎉 Semana completa!".
// =============================================================================

interface PlanStep {
  id: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  title: string;
  description: string;
  /** Ação principal: rota interna ou null (passos passivos) */
  cta?: { label: string; path: string };
}

// 4 jornadas — rotacionam ao longo das semanas pra ter variedade
const WEEKLY_JOURNEYS: PlanStep[][] = [
  // Semana A: Aquecimento
  [
    {
      id: "practice-A",
      icon: "self_improvement",
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
      title: "🌱 Prática: Respiração no carro parado",
      description: "Sente no banco do motorista (carro DESLIGADO), 3 respirações fundas. 2 min. Esse é o primeiro passo.",
    },
    {
      id: "lesson-A",
      icon: "play_circle",
      iconColor: "text-primary",
      bgColor: "bg-primary/10 border-primary/20",
      title: "🎬 Assista: 1 aula da Biblioteca",
      description: "Escolha qualquer aula que te chame mais hoje. Não precisa ser em ordem.",
      cta: { label: "Ver Biblioteca", path: "/biblioteca" },
    },
    {
      id: "mission-A",
      icon: "task_alt",
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      title: "🎯 Conquista 1 missão fácil",
      description: "Vá no Perfil → Missões e marque uma do grupo 🌱 Aquecimento.",
      cta: { label: "Ver Missões", path: "/perfil" },
    },
  ],
  // Semana B: Em Marcha
  [
    {
      id: "practice-B",
      icon: "directions_car",
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10 border-orange-500/20",
      title: "🚗 Prática: Dê 5 voltas no quarteirão",
      description: "Com alguém de confiança do lado. Sem pressa. Foco em respirar e olhar longe.",
    },
    {
      id: "lesson-B",
      icon: "play_circle",
      iconColor: "text-primary",
      bgColor: "bg-primary/10 border-primary/20",
      title: "🎬 Assista: 2 aulas seguidas",
      description: "Pegue um café, fone no ouvido e mergulhe. 30 min e pronto.",
      cta: { label: "Ver Biblioteca", path: "/biblioteca" },
    },
    {
      id: "mission-B",
      icon: "redeem",
      iconColor: "text-purple-500",
      bgColor: "bg-purple-500/10 border-purple-500/20",
      title: "🎰 Gire a Roleta da Sorte",
      description: "Toda sexta gire pra ganhar moedas, escudo ou turbo XP.",
      cta: { label: "Ir pra Roleta", path: "/perfil" },
    },
  ],
  // Semana C: Avenida
  [
    {
      id: "practice-C",
      icon: "route",
      iconColor: "text-cyan-500",
      bgColor: "bg-cyan-500/10 border-cyan-500/20",
      title: "🛣️ Prática: 1 trajeto curto na avenida",
      description: "5km no fim de tarde (trânsito leve). Companheiro do lado se quiser. Você consegue.",
    },
    {
      id: "lesson-C",
      icon: "groups",
      iconColor: "text-pink-500",
      bgColor: "bg-pink-500/10 border-pink-500/20",
      title: "💬 Participe da Comunidade",
      description: "Curta ou comente 1 post de outra aluna que tá no mesmo caminho que você.",
      cta: { label: "Ir pra Comunidade", path: "/comunidade" },
    },
    {
      id: "mission-C",
      icon: "menu_book",
      iconColor: "text-cyan-500",
      bgColor: "bg-cyan-500/10 border-cyan-500/20",
      title: "📚 Complete 3 aulas",
      description: "Sequência forte essa semana — ganhe a medalha Estudioso 📚.",
      cta: { label: "Ver Biblioteca", path: "/biblioteca" },
    },
  ],
  // Semana D: Vitória
  [
    {
      id: "practice-D",
      icon: "emoji_events",
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      title: "🏆 Prática: Dirija até um lugar novo",
      description: "Um restaurante, uma amiga, o mercado de outro bairro. Você decide. Você vai.",
    },
    {
      id: "lesson-D",
      icon: "mic",
      iconColor: "text-rose-500",
      bgColor: "bg-rose-500/10 border-rose-500/20",
      title: "🎙️ Compartilhe sua vitória",
      description: "Poste na Comunidade — sua história ajuda muito quem tá começando agora.",
      cta: { label: "Ir pra Comunidade", path: "/comunidade" },
    },
    {
      id: "mission-D",
      icon: "savings",
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      title: "💰 Resgate um cupom de cashback",
      description: "Suas moedas viram desconto. Bom pra próximo curso ou pra você se mimar.",
      cta: { label: "Ver Cashback", path: "/perfil" },
    },
  ],
];

/** Retorna ISO week id no formato "YYYY-W##" */
function getWeekId(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday in current week decides the year
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getJourneyForWeek(weekId: string): PlanStep[] {
  // Hash simples baseado no número da semana pra rotacionar 4 jornadas
  const weekNum = parseInt(weekId.split("-W")[1] || "0", 10);
  return WEEKLY_JOURNEYS[weekNum % WEEKLY_JOURNEYS.length];
}

/** Próxima segunda 00:00 (horário local) — quando o plano renova. */
function nextMondayMidnight(from = new Date()): Date {
  const d = from.getDay(); // 0=domingo … 6=sábado
  const add = ((1 - d + 7) % 7) || 7; // dias até a próxima segunda (hoje segunda → +7)
  const next = new Date(from);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + add);
  return next;
}

/** Formata ms restantes em "Xd YYh ZZm" ou "HHh MMm SSs" quando falta < 1 dia. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "renovando…";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return d >= 1 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}h ${p(m)}m ${p(sec)}s`;
}

export function WeeklyPlanCard() {
  const { user } = useAuth();
  const { addCoins } = useUserProgress();
  const navigate = useNavigate();
  const weekId = useMemo(() => getWeekId(), []);
  const journey = useMemo(() => getJourneyForWeek(weekId), [weekId]);

  // Estado dos checks — persistido em localStorage por user+semana.
  // Uma tarefa concluída SOME da lista (não dá pra desmarcar).
  const storageKey = user ? `mddnm:weekly:${user.id}:${weekId}` : null;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Só true quando a aluna fecha a última tarefa AGORA — a celebração aparece
  // nesse momento e não se repete nas próximas visitas (aí vira barra slim).
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  // Conclui uma tarefa: anima as moedas daquela tarefa subindo pro saldo,
  // credita a recompensa (1x — guardado pelo próprio `checked`) e some da lista.
  const complete = (step: PlanStep, originEl: HTMLElement | null) => {
    if (checked[step.id]) return; // já concluída
    const reward = rewardForStep(step.id);
    const next = { ...checked, [step.id]: true };
    setChecked(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    }
    // Fechou a última tarefa agora? mostra a celebração só nesta visita.
    if (journey.every((s) => next[s.id])) setJustCompleted(true);
    flyCoins({
      fromEl: originEl,
      count: Math.max(8, Math.round(reward / 2)),
      label: `+${reward}`,
      onDone: () => {
        void addCoins(reward);
        toast.success(`+${reward} moedas! 💛`);
      },
    });
  };

  const total = journey.length;
  const doneCount = journey.filter((s) => checked[s.id]).length;
  const allDone = doneCount === total;
  const pendingSteps = journey.filter((s) => !checked[s.id]);

  // Contagem regressiva até renovar (só roda quando a semana está completa).
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!allDone) return;
    setNowTs(Date.now());
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [allDone]);
  const resetMs = nextMondayMidnight().getTime() - nowTs;
  const earnedThisWeek = journey.reduce((sum, s) => sum + (checked[s.id] ? rewardForStep(s.id) : 0), 0);

  if (!user) return null;

  // Semana já estava completa quando ela abriu a tela → não repete a festa.
  // Vira uma barra slim: só o contador pra renovar + atalho pras missões.
  if (allDone && !justCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card border border-border rounded-2xl px-4 py-3 mb-6 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none">
            Novas tarefas em
          </p>
          <p className="text-base md:text-lg font-black tabular-nums text-primary leading-tight mt-1">
            {formatCountdown(resetMs)}
          </p>
        </div>
        <button
          onClick={() => navigate("/perfil")}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-widest hover:scale-[1.03] active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base filled-icon">target</span>
          Fazer missões 🪙
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card border border-border rounded-[32px] p-5 md:p-7 shadow-sm mb-6 relative overflow-hidden"
    >
      {/* Decoração de fundo */}
      <div className="absolute -top-12 -right-12 size-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" aria-hidden />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">
              🎯 Esta semana você vai…
            </p>
            <h3 className="font-black text-lg md:text-xl text-foreground leading-tight">
              {allDone ? "🎉 Semana completa!" : `${doneCount} de ${total} feitas`}
            </h3>
            {earnedThisWeek > 0 && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black uppercase tracking-wide bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[13px] filled-icon text-yellow-500">database</span>
                +{earnedThisWeek} moedas esta semana
              </span>
            )}
          </div>
          {/* Progress circle */}
          <div className="relative size-12 shrink-0">
            <svg className="size-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" className="text-muted" fill="none" />
              <motion.circle
                cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"
                className="text-primary"
                strokeDasharray={`${(doneCount / total) * 125.6} 125.6`}
                initial={{ strokeDasharray: "0 125.6" }}
                animate={{ strokeDasharray: `${(doneCount / total) * 125.6} 125.6` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black">
              {Math.round((doneCount / total) * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {pendingSteps.map((step) => {
              const reward = rewardForStep(step.id);
              return (
                <motion.div
                  key={step.id}
                  data-step-row
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, scale: 0.92, transition: { duration: 0.3 } }}
                  className={`flex items-start gap-3 p-3 md:p-4 rounded-2xl border transition-all ${step.bgColor}`}
                >
                  <button
                    onClick={(e) => complete(step, (e.currentTarget as HTMLElement).closest("[data-step-row]") as HTMLElement)}
                    className="size-6 md:size-7 rounded-full border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 border-muted-foreground/40 hover:border-emerald-500 hover:bg-emerald-500/10"
                    aria-label="Concluir tarefa"
                    title="Marcar como concluída"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black leading-tight mb-1 text-foreground">
                      {step.title}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {step.description}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-black uppercase tracking-wide bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 px-2 py-0.5 rounded-full">
                      <span className="material-symbols-outlined text-[12px] filled-icon text-yellow-500">database</span>
                      +{reward} ao concluir
                    </span>
                  </div>

                  {step.cta && (
                    <button
                      onClick={() => navigate(step.cta!.path)}
                      className="shrink-0 self-center px-3 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-transform"
                    >
                      {step.cta.label}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 bg-accent/40 border border-border rounded-2xl px-4 py-3"
            >
              {/* Contador até renovar (próxima segunda) */}
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none">
                  Novas tarefas em
                </p>
                <p className="text-lg font-black tabular-nums text-primary leading-tight mt-1">
                  {formatCountdown(resetMs)}
                </p>
              </div>
              {/* Enquanto isso: missões no Perfil rendem moedas o mês todo */}
              <button
                onClick={() => navigate("/perfil")}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-widest hover:scale-[1.03] active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-base filled-icon">target</span>
                Fazer missões 🪙
              </button>
            </motion.div>
          )}
        </div>

        {/* Mensagem motivacional baseada no progresso */}
        {!allDone && (
          <p className="text-[11px] text-muted-foreground mt-3 text-center italic">
            {doneCount === 0
              ? "Comece pelo mais leve. Cada tarefa concluída rende moedas."
              : doneCount === total - 1
                ? "Falta só uma! Tá quase lá."
                : "No seu ritmo. Não precisa fazer tudo hoje."}
          </p>
        )}
      </div>
    </motion.div>
  );
}
