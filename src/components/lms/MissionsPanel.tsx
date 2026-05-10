import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMissions, type UserMission } from "@/hooks/useMissions";

// ─── MissionsPanel ───────────────────────────────────────────────────────────
// Painel de missões mensais. Mostra:
//   - Header: contagem de dias restantes do ciclo + miniatura "X de Y feitas"
//   - Lista de cards: cada missão tem ícone, título, descrição, barra de
//     progresso (se cumulativa) e botão de ação:
//       • "Resgatar +X 🪙" se completed e !claimed
//       • "Resgatado" se claimed
//       • "Em andamento" + barra se ainda nao completou
//
// Importante: o cap silencioso de moedas/ciclo NÃO é mostrado pro user.
// =============================================================================

const CATEGORY_LABEL: Record<string, string> = {
  login:    "Acesso",
  watch:    "Estudo",
  engage:   "Progresso",
  social:   "Comunidade",
  wellness: "Bem-estar",
  learn:    "Conhecimento",
  practice: "Prática",
};

const CATEGORY_COLOR: Record<string, string> = {
  login:    "text-blue-500",
  watch:    "text-orange-500",
  engage:   "text-primary",
  social:   "text-emerald-500",
  wellness: "text-pink-500",
  learn:    "text-purple-500",
  practice: "text-cyan-500",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return diff;
}

function MissionCard({
  mission,
  onClaim,
  onSelfReport,
}: {
  mission: UserMission;
  onClaim: () => void;
  onSelfReport: () => void;
}) {
  const isClaimed = !!mission.claimed_at;
  const isReady = !!mission.completed_at && !isClaimed;
  const isSelfReport = mission.trigger_type === "self_report";
  const progress = Math.min(mission.progress_value, mission.trigger_target);
  const pct = mission.trigger_target > 0
    ? Math.round((progress / mission.trigger_target) * 100)
    : 0;
  const colorClass = CATEGORY_COLOR[mission.category] ?? "text-primary";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`relative bg-card border rounded-2xl p-4 transition-all ${
        isReady
          ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30"
          : isClaimed
          ? "border-border opacity-60"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`size-10 rounded-xl bg-accent/40 border border-border flex items-center justify-center shrink-0 ${colorClass}`}>
          <span className="material-symbols-outlined filled-icon text-xl">{mission.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-bold text-sm text-foreground leading-tight">{mission.title}</p>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 shrink-0">
              {CATEGORY_LABEL[mission.category] ?? mission.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug mb-2">{mission.description}</p>

          {/* Barra de progresso (só pra missões cumulativas E não self-report) */}
          {mission.trigger_target > 1 && !isClaimed && !isSelfReport && (
            <div className="mb-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isReady ? "bg-primary" : "bg-muted-foreground/40"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                {progress} / {mission.trigger_target}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              🪙 {mission.reward_coins}
            </span>
            {isClaimed ? (
              <span className="text-[11px] font-bold text-emerald-500 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Resgatado
              </span>
            ) : isSelfReport ? (
              // Botão "Marcar como feita" pra missões manuais
              <button
                onClick={onSelfReport}
                className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                Fiz isso
              </button>
            ) : isReady ? (
              <button
                onClick={onClaim}
                className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Resgatar
              </button>
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                {DIFFICULTY_LABEL[mission.difficulty] ?? mission.difficulty}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function MissionsPanel() {
  const { missions, cycleEnd, loading, claim, selfReport } = useMissions();
  const [claiming, setClaiming] = useState<string | null>(null);

  const counts = useMemo(() => {
    const total = missions.length;
    const completed = missions.filter((m) => m.completed_at).length;
    const claimed = missions.filter((m) => m.claimed_at).length;
    return { total, completed, claimed };
  }, [missions]);

  const daysLeft = daysUntil(cycleEnd);

  async function handleAction(m: UserMission, kind: "claim" | "self") {
    if (claiming) return;
    setClaiming(m.id);
    try {
      const result = kind === "self" ? await selfReport(m.id) : await claim(m.id);
      if (result?.granted_coins && result.granted_coins > 0) {
        toast.success(`+${result.granted_coins} 🪙 moedas!`, {
          description: `Pela missão "${m.title}"`,
          duration: 4000,
        });
      } else {
        // Cap silencioso atingido — toast neutro (não revela o motivo)
        toast.success("Missão concluída!", {
          description: "Continue assim, vem mais por aí.",
          duration: 3500,
        });
      }
    } catch (err: any) {
      console.warn("[missions] action error:", err);
      toast.error("Não foi possível registrar agora", {
        description: "Tenta de novo em instantes.",
      });
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-[32px] border border-border p-6 mb-6">
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Carregando missões…
        </div>
      </div>
    );
  }

  if (missions.length === 0) return null;

  return (
    <div className="bg-card rounded-[32px] border border-border p-6 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-primary filled-icon">target</span>
            Missões do Mês
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {counts.claimed} de {counts.total} resgatadas
            {daysLeft > 0 && <span> · termina em <strong>{daysLeft} dias</strong></span>}
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {missions.map((m) => (
            <MissionCard
              key={m.id}
              mission={m}
              onClaim={() => handleAction(m, "claim")}
              onSelfReport={() => handleAction(m, "self")}
            />
          ))}
        </AnimatePresence>
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-4 italic">
        ⚡ Novas missões a cada ciclo. As moedas viram desconto nos próximos cursos.
      </p>
    </div>
  );
}
