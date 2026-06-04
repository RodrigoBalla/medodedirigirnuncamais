import { useEffect } from "react";
import { motion } from "framer-motion";
import { EduzzCheckoutEmbed } from "./EduzzCheckoutEmbed";

// ─── CheckoutModal ───────────────────────────────────────────────────────────
// Popup ÚNICO e PADRÃO do checkout da Eduzz pra TODA a plataforma. Abre por cima
// da página (modal/lightbox) — nunca abre aba nova e nunca fica embedado inline.
// Usado em todo lugar que vende um curso (CourseInfo, AccessExpiredScreen, etc.)
// pra a experiência de compra ser SEMPRE igual.
//
//   • Desktop: card centralizado.
//   • Mobile: ocupa a tela (com scroll), fecha no X / Esc / clique fora.
// =============================================================================

interface Props {
  open: boolean;
  onClose: () => void;
  /** Slug do checkout Eduzz (ex: "E05NOV749X"). */
  contentId: string;
  /** Título mostrado no topo do modal. */
  title?: string;
}

export function CheckoutModal({ open, onClose, contentId, title }: Props) {
  // Trava o scroll do fundo e fecha no Esc enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-full flex items-start sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-full sm:max-w-md bg-card border border-border sm:rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header sticky com título + fechar */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card sm:rounded-t-2xl">
            <p className="font-black text-sm line-clamp-1">{title || "Finalize sua inscrição"}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 size-9 rounded-full hover:bg-accent flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {/* Checkout */}
          <div className="p-4">
            <EduzzCheckoutEmbed contentId={contentId} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
