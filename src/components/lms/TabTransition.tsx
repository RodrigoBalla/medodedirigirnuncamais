import { useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ─── TabTransition ───────────────────────────────────────────────────────────
// Transição entre as abas da área de membros, com a cara da plataforma:
//   • o conteúdo "segue na estrada" — sai por um lado e o novo entra pelo outro,
//     com um leve desfoque que limpa (sensação de foco chegando);
//   • uma FAIXA DE PISTA amarela (tracejada, igual sinalização de via) varre o
//     topo a cada troca.
// A direção acompanha a ordem das abas no menu (indo pra direita/esquerda).
//
// Duração total ~0.55s — bem abaixo do teto de 3s pedido pelo Balla, pra não
// deixar a navegação lenta. Respeita prefers-reduced-motion (sem movimento).
// =============================================================================

interface Props {
  /** Aba ativa — troca dela dispara a animação. */
  tabKey: string;
  /** Ordem das abas no menu, pra decidir o sentido do movimento. */
  order?: string[];
  children: ReactNode;
}

export function TabTransition({ tabKey, order = [], children }: Props) {
  const reduceMotion = useReducedMotion();
  const prevTab = useRef(tabKey);
  const dir = useRef(1);

  // Sentido: +1 se avançou no menu, -1 se voltou.
  if (prevTab.current !== tabKey) {
    const de = order.indexOf(prevTab.current);
    const para = order.indexOf(tabKey);
    dir.current = de >= 0 && para >= 0 && para < de ? -1 : 1;
    prevTab.current = tabKey;
  }

  // Acessibilidade: quem pediu menos movimento recebe o conteúdo direto.
  if (reduceMotion) return <>{children}</>;

  const d = dir.current;

  return (
    <div className="relative">
      {/* Faixa de pista varrendo o topo (sinalização de via) */}
      <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden pointer-events-none z-20">
        <motion.div
          key={`faixa-${tabKey}`}
          initial={{ x: d > 0 ? "-110%" : "110%" }}
          animate={{ x: d > 0 ? "110%" : "-110%" }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="h-full w-full"
          style={{
            background:
              "repeating-linear-gradient(90deg, hsl(var(--primary)) 0 22px, transparent 22px 40px)",
            filter: "drop-shadow(0 0 6px hsl(var(--primary) / .55))",
          }}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tabKey}
          initial={{ opacity: 0, x: 26 * d, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            x: -18 * d,
            filter: "blur(4px)",
            transition: { duration: 0.18, ease: "easeIn" },
          }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
