import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── EmergencyContactFab ─────────────────────────────────────────────────────
// FAB flutuante "Travou? Me chama" — sempre visível em todas as telas do app.
// Pra quem tem ataque de pânico no volante, saber QUEM chamar e ter o
// contato a 1 toque vale mais que 10 features de gamificação.
//
// Quando clica: abre painel com mensagem motivacional + botão WhatsApp
// direto. Quando fecha: minimiza pro canto.
//
// Config (texto/wpp) ficam aqui pra fácil edição. Quando admin tiver edição
// no painel, migra pra tabela `support_contacts`.
// =============================================================================

const SUPPORT = {
  name: "Carla",
  role: "sua instrutora",
  // Número no formato internacional sem espaços/parênteses — ajuste quando o
  // contato real for definido. Mensagem pré-preenchida vai no `text=`.
  whatsapp: "5511999999999",
  whatsappMessage: "Oi Carla, preciso de uma força aqui.",
  // Avatar opcional (URL ou inicial). Por enquanto usa a letra inicial.
};

const STORAGE_KEY = "mddnm:sos:tip-seen";

export function EmergencyContactFab() {
  const [open, setOpen] = useState(false);
  // Mostra "tip" pulsante na primeira vez (pra aluno descobrir a feature)
  const [showTip, setShowTip] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) !== "1";
  });

  // Esc fecha o painel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Dismissa o tip quando o user abre o painel pela 1ª vez
  useEffect(() => {
    if (open && showTip) {
      setShowTip(false);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    }
  }, [open, showTip]);

  const wppUrl = `https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent(SUPPORT.whatsappMessage)}`;

  return (
    <>
      {/* ─── FAB botão circular fixo ─────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40 size-14 md:size-16 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_8px_30px_rgba(244,63,94,.5)] flex items-center justify-center group"
        aria-label="Pedir ajuda"
        title="Fala com a Carla"
      >
        {/* Pulse aura quando ainda não foi descoberto */}
        {showTip && (
          <motion.span
            className="absolute inset-0 rounded-full bg-rose-500"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            aria-hidden
          />
        )}
        <span className="material-symbols-outlined filled-icon text-2xl md:text-3xl relative z-10">
          support_agent
        </span>
        {/* Tooltip de descoberta — só aparece 1 vez */}
        {showTip && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-foreground text-background text-xs font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-lg pointer-events-none"
          >
            Fala com a Carla
            <span className="absolute left-full top-1/2 -translate-y-1/2 size-0 border-l-[6px] border-y-[6px] border-y-transparent border-l-foreground" />
          </motion.div>
        )}
      </motion.button>

      {/* ─── Painel/Modal "Me chama" ─────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-hidden
            />

            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="relative z-10 w-full max-w-md bg-card border-2 border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Faixa de "advertência" no topo — identidade visual de trânsito */}
              <div className="caution-tape h-2" aria-hidden />

              <div className="p-6 md:p-7">
                <button
                  onClick={() => setOpen(false)}
                  className="absolute top-4 right-4 size-8 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center transition-colors"
                  aria-label="Fechar"
                  title="Fechar (Esc)"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>

                {/* Avatar + nome */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white font-black text-3xl flex items-center justify-center shrink-0 shadow-lg">
                    {SUPPORT.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-0.5">
                      Fala comigo
                    </p>
                    <h2 className="font-black text-xl text-foreground leading-tight">
                      {SUPPORT.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">{SUPPORT.role}</p>
                  </div>
                </div>

                {/* Mensagem da Carla — tom natural, como se ela tivesse digitado */}
                <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    Oi, é a Carla. Travou? Me chama no zap. Pode ser texto ou áudio,
                    do jeito que for mais fácil pra você.
                  </p>
                  <p className="text-sm text-foreground leading-relaxed mt-2">
                    Às vezes demoro um pouquinho, mas respondo sempre.
                  </p>
                </div>

                {/* CTA WhatsApp */}
                <a
                  href={wppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-base uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined">chat</span>
                  Abrir conversa no WhatsApp
                </a>

                <p className="text-[11px] text-center text-muted-foreground mt-3">
                  Respondo de seg a sáb, das 9h às 21h. Se for emergência no trânsito, liga <strong className="text-foreground">190</strong>.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
