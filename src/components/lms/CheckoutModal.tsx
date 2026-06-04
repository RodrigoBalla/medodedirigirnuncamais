import { useEffect } from "react";
import { motion } from "framer-motion";

// ─── CheckoutModal ───────────────────────────────────────────────────────────
// Popup ÚNICO e PADRÃO do checkout pra TODA a plataforma. Abre por cima da
// página (modal/lightbox) — nunca aba nova, nunca embed inline na página.
//
// COMO RENDERIZA (importante):
// Carrega o checkout HOSPEDADO da Eduzz (chk.eduzz.com/<código>) dentro de um
// <iframe>. Cada vez que o modal abre, monta um iframe NOVO → documento novo →
// o checkout inicializa do ZERO toda vez.
//
// Por que NÃO usamos mais o bridge.js injetado na nossa página: o bridge só
// inicializa UMA vez por carga de página. No SPA, depois de abrir o primeiro
// checkout, os próximos ficavam "already initialized" e só carregavam dando
// refresh ("todos os checkouts só carregam quando dou refresh"). O iframe da
// página hospedada não tem esse problema — recarrega inteiro a cada abertura.
//
//   • Desktop: card centralizado alto.
//   • Mobile: ocupa a tela. Fecha no X / Esc / clique fora.
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

  const checkoutUrl = `https://chk.eduzz.com/${contentId}`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full sm:max-w-md bg-card sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com título + fechar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
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

        {/* Checkout hospedado da Eduzz — iframe fresco a cada abertura.
            key={contentId} garante remontagem ao trocar de curso. */}
        <iframe
          key={contentId}
          src={checkoutUrl}
          title="Checkout seguro Eduzz"
          className="flex-1 w-full bg-white"
          allow="payment"
        />

        {/* Escotilha: se o iframe não carregar (ex: bloqueio de cookies do
            navegador), abre o checkout em nova aba — first-party, sempre funciona. */}
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-primary border-t border-border transition-colors"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          Não carregou? Abrir em nova aba
        </a>
      </motion.div>
    </div>
  );
}
