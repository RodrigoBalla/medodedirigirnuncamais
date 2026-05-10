import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// ─── AutoplayCountdown ───────────────────────────────────────────────────────
// Overlay estilo Netflix mostrado ao final de uma aula. Faz contagem
// regressiva de N segundos e dispara `onAdvance()`. Usuário pode cancelar.
// =============================================================================

interface Props {
  /** Título da próxima aula (mostrado no card) */
  nextTitle: string;
  /** Segundos pra contar antes de avançar — default 5 */
  seconds?: number;
  /** Callback disparado quando contador chega a 0 OU usuário clica "Próxima" */
  onAdvance: () => void;
  /** Usuário pediu pra cancelar o auto-play */
  onCancel: () => void;
}

export function AutoplayCountdown({ nextTitle, seconds = 5, onAdvance, onCancel }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onAdvance();
      return;
    }
    const t = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining, onAdvance]);

  const pct = ((seconds - remaining) / seconds) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-end justify-end p-6 pointer-events-none"
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-80 pointer-events-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          Próxima missão
        </p>
        <p className="text-base font-bold text-foreground line-clamp-2 mb-4">{nextTitle}</p>
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
          >
            Ficar aqui
          </button>
          <button
            onClick={onAdvance}
            className="flex-1 px-3 py-2 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
          >
            Próxima · {remaining}s
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
