import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CashbackCard } from "./CashbackCard";

// ─── CashbackModal ───────────────────────────────────────────────────────────
// Popup que envolve o CashbackCard. Acionado quando o user clica no
// contador de moedas no header — mostra o saldo, quanto vale em R$,
// e permite converter em cupom de desconto sem sair da pagina atual.
//
// O CashbackCard ja faz todo o fetch + calculo + conversao;
// aqui so adicionamos o overlay/backdrop + close.
// =============================================================================

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CashbackModal({ open, onClose }: Props) {
  // Bloqueia scroll do body quando aberto + fecha com ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />

          {/* Modal box */}
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="relative z-10 w-full max-w-md md:max-w-lg max-h-[92vh] overflow-y-auto"
          >
            {/* Botão fechar — sobreposto ao card */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 size-9 rounded-full bg-background/90 border border-border text-muted-foreground hover:text-foreground hover:bg-background flex items-center justify-center transition-colors shadow-md"
              aria-label="Fechar"
              title="Fechar (Esc)"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            {/* Header decorativo curto antes do CashbackCard */}
            <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-x-2 border-t-2 border-amber-500/30 rounded-t-[32px] px-6 py-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                💰 Calcule seu desconto
              </p>
            </div>

            {/* CashbackCard com cantos arredondados ajustados pra ficar acoplado ao header */}
            <div className="[&>div]:rounded-t-none [&>div]:!mb-0 [&>div]:border-amber-500/30 [&>div]:border-2">
              <CashbackCard />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
