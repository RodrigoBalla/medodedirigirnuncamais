import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── FullAccessBanner ────────────────────────────────────────────────────────
// Barra FIXA (sticky) no topo da área de membros — fica visível em todas as
// abas mesmo com scroll. Texto rotativo com fade in/out (3 mensagens). Ao
// clicar, leva pra página interna /acesso-completo (checkout embutido +
// explicação da oferta).
//
// A visibilidade (só pra quem ainda NÃO tem o acesso completo) é decidida no
// AppLayout via useHasFullPlatformAccess — aqui é só a apresentação. Fica
// grudado logo abaixo do header (top-[53px]) com altura fixa (h-10) pra o
// AppLayout compensar o offset da sidebar no desktop.
// =============================================================================

const MESSAGES = [
  "Oportunidade única",
  "Tudo o que a plataforma já tem",
  "Clique aqui e saiba mais",
];

interface Props {
  // Offset do sticky conforme o contexto: abaixo do header do app (top-[53px],
  // default) ou no topo do conteúdo dentro do course player (top-0).
  stickyTopClass?: string;
}

export function FullAccessBanner({ stickyTopClass = "top-[53px]" }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % MESSAGES.length);
    }, 2600);
    return () => window.clearInterval(t);
  }, []);

  return (
    <Link
      to="/acesso-completo"
      title="Liberar acesso completo à plataforma — oferta especial"
      className={`group sticky ${stickyTopClass} z-40 flex h-10 w-full items-center justify-center gap-2 overflow-hidden bg-gradient-to-r from-primary to-yellow-400 px-3 text-primary-foreground shadow-md md:gap-3`}
    >
      <span className="material-symbols-outlined shrink-0 text-xl filled-icon animate-pulse">
        bolt
      </span>
      <span className="shrink-0 rounded-full bg-black/85 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary md:text-[10px]">
        Oferta especial
      </span>

      {/* Texto rotativo com fade in/out */}
      <span className="relative flex h-5 min-w-0 flex-1 items-center justify-center overflow-hidden text-center md:flex-none md:justify-start">
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4 }}
            className="block truncate text-xs font-black leading-none md:text-sm"
          >
            {MESSAGES[idx]}
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="material-symbols-outlined shrink-0 text-base transition-transform group-hover:translate-x-0.5 md:text-lg">
        arrow_forward
      </span>
    </Link>
  );
}
