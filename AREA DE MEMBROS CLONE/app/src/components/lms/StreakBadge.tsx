import { motion } from "framer-motion";
import { useStreak } from "@/hooks/useStreak";

// ─── StreakBadge ─────────────────────────────────────────────────────────────
// Badge "🔥 X dias" mostrado no header. Quando streak >= 1, anima sutilmente.
// Em marcos altos (7+) o ícone fica laranja vivo. Hover mostra tooltip com
// próximo marco e quanto ganha.
// =============================================================================

const NEXT_MILESTONES = [3, 7, 15, 30, 60, 100];
const MILESTONE_REWARDS: Record<number, number> = {
  3: 10, 7: 25, 15: 50, 30: 100, 60: 250, 100: 500,
};

function getNextMilestone(streak: number) {
  return NEXT_MILESTONES.find((m) => m > streak) ?? null;
}

interface Props {
  className?: string;
}

export function StreakBadge({ className }: Props) {
  const { streak, loading } = useStreak();
  if (loading) return null;
  if (streak < 1) return null;

  const next = getNextMilestone(streak);
  const isHot = streak >= 7;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border ${
        isHot
          ? "border-orange-500/50 bg-gradient-to-r from-orange-500/15 to-amber-500/15"
          : "border-border bg-accent/40"
      } ${className ?? ""}`}
      title={
        next
          ? `Próxima medalha: ${next} dias (+${MILESTONE_REWARDS[next]} 🪙)`
          : "Você é uma lenda — segue assim!"
      }
    >
      <motion.span
        animate={isHot ? { scale: [1, 1.15, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.6 }}
        className={`text-base ${isHot ? "" : "opacity-90"}`}
      >
        🔥
      </motion.span>
      <span className={`text-sm font-black ${isHot ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>
        {streak}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:inline">
        dias
      </span>
    </motion.div>
  );
}
