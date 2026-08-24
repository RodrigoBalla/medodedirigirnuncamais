import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { safeRoute, safeExternal, type Announcement } from "@/lib/announcements";

// ─── AnnouncementPopup ───────────────────────────────────────────────────────
// Popup de aviso do admin, mostrado 1x pra aluna no próximo login (controle
// server-side, ver useAnnouncements). Montado só pra alunas no AppLayout.
//
//   • emoji + título + corpo + (opcional) botão de CTA.
//   • CTA leva pra rota interna (ex: o curso com as aulas novas) ou url externa.
//   • Fechar de qualquer jeito (CTA, "agora não", X, backdrop, Esc) marca como
//     visto — não reaparece.
// =============================================================================

export function AnnouncementPopup({ previewData }: { previewData?: Announcement } = {}) {
  const live = useAnnouncements();
  const [previewOpen, setPreviewOpen] = useState(true);
  const nav = useNavigate();

  // Modo preview (rota interna /preview-alert): renderiza o aviso passado por
  // prop, sem depender de auth/RPC. Em produção, previewData é undefined e usa
  // o hook normalmente.
  const announcement = previewData ? (previewOpen ? previewData : null) : live.announcement;
  const dismiss = previewData ? () => setPreviewOpen(false) : live.dismiss;

  // Confetti sutil quando o aviso aparece (é notícia boa).
  useEffect(() => {
    if (!announcement) return;
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.35 },
      colors: ["#FFD60A", "#FFC700", "#FFFFFF"],
      ticks: 160,
      gravity: 0.8,
      zIndex: 126,
    });
  }, [announcement]);

  // Esc fecha (conta como visto).
  useEffect(() => {
    if (!announcement) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [announcement, dismiss]);

  if (!announcement) return null;

  const a = announcement;
  const route = safeRoute(a.cta_route);
  const href = route ? null : safeExternal(a.cta_href);
  const hasCta = !!(a.cta_label && (route || href));

  const handleCta = () => {
    dismiss();
    if (route) nav(route);
    else if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[125] flex items-end md:items-center justify-center p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden
        />
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="relative z-10 w-full max-w-md bg-card border-2 border-primary/30 rounded-3xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Fita de advertência — identidade trânsito */}
          <div className="caution-tape h-2" aria-hidden />

          {/* Botão X discreto */}
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-20 size-9 rounded-full bg-muted/70 hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>

          <div className="p-6 md:p-7 text-center">
            {/* Emoji badge com bounce-in */}
            <motion.div
              initial={{ scale: 0, rotate: -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 12 }}
              className="mx-auto mb-4 size-16 rounded-2xl bg-gradient-to-br from-primary to-yellow-500 flex items-center justify-center text-3xl shadow-lg shadow-primary/30"
            >
              <span aria-hidden>{a.emoji || "🎉"}</span>
            </motion.div>

            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1.5">
              Novidade pra você
            </p>
            <h2
              className="font-black text-xl md:text-2xl text-foreground leading-tight mb-2.5"
              style={{ textWrap: "balance" }}
            >
              {a.title}
            </h2>
            <p
              className="text-sm text-muted-foreground leading-relaxed mb-6 whitespace-pre-wrap break-words"
              style={{ textWrap: "balance" }}
            >
              {a.body}
            </p>

            <div className="flex flex-col gap-2">
              {hasCta && (
                <button
                  onClick={handleCta}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-base">play_circle</span>
                  {a.cta_label}
                </button>
              )}
              <button
                onClick={dismiss}
                className="w-full py-3 rounded-2xl border border-border bg-background text-foreground font-bold text-sm hover:bg-accent transition-colors"
              >
                {hasCta ? "Agora não" : "Ok, entendi"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
