import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

// ─── MissionsTutorial ────────────────────────────────────────────────────────
// Tutorial guiado da 1ª missão. Aparece quando a aluna chega no Perfil e ainda
// não concluiu nenhuma missão. Ilumina o card de uma missão acionável, aponta
// pro botão de ação ("Fiz isso"/"Resgatar") e fica ali ATÉ ela concluir uma —
// então mostra o "é assim que funciona!" e some pra sempre. Também tem "Pular".
//
// Controlado pelo MissionsPanel (que tem o estado das missões). Aqui é só a UI.
// Alvo é localizado por [data-mission-id="<id>"], reposicionado a cada 300ms
// pra acompanhar scroll/resize.
// =============================================================================

interface Props {
  active: boolean;
  step: "point" | "success";
  targetId: string | null;
  actionLabel: string; // "Fiz isso" | "Resgatar"
  onSkip: () => void;
  onFinish: () => void;
}

const Z = 2147483000;

export function MissionsTutorial({ active, step, targetId, actionLabel, onSkip, onFinish }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active || step !== "point") { setRect(null); return; }
    const update = () => {
      const el = targetId ? document.querySelector(`[data-mission-id="${targetId}"]`) : null;
      const r = el ? el.getBoundingClientRect() : null;
      setRect(r && r.width > 0 ? r : null);
    };
    update();
    const iv = window.setInterval(update, 300);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, step, targetId]);

  if (!active || typeof document === "undefined") return null;

  // ── Passo final: modal centralizado de sucesso ─────────────────────────────
  if (step === "success") {
    return createPortal(
      <div
        style={{ position: "fixed", inset: 0, zIndex: Z, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(2,8,23,.72)", backdropFilter: "blur(4px)" }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-primary/40 rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl"
        >
          <div className="text-5xl mb-2">🎉</div>
          <h3 className="font-black text-lg text-foreground mb-1">É assim que funciona!</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Você concluiu sua primeira missão e ganhou moedas 🪙. Complete as outras pra encher o saldo e virar desconto nos próximos cursos.
          </p>
          <button
            onClick={onFinish}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest hover:opacity-90 transition-opacity"
          >
            Entendi!
          </button>
        </motion.div>
      </div>,
      document.body,
    );
  }

  // ── Passo "apontar": spotlight no card + tooltip ───────────────────────────
  const tooltip = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto bg-primary text-primary-foreground rounded-2xl px-4 py-3 shadow-2xl max-w-[290px]"
    >
      <p className="text-sm font-black leading-snug">
        👇 Toque em <span className="underline">"{actionLabel}"</span> pra concluir sua primeira missão e ganhar moedas 🪙
      </p>
      <button onClick={onSkip} className="mt-2 text-[11px] font-bold underline opacity-90 hover:opacity-100">
        Pular tutorial
      </button>
    </motion.div>
  );

  const pad = 8;
  const hasRect = !!rect;

  return createPortal(
    hasRect ? (
      <>
        {/* Spotlight: escurece a tela toda menos o card (box-shadow gigante),
            sem bloquear cliques (pointer-events:none) pra ela clicar no botão. */}
        <div
          className="animate-pulse"
          style={{
            position: "fixed",
            top: rect!.top - pad,
            left: rect!.left - pad,
            width: rect!.width + pad * 2,
            height: rect!.height + pad * 2,
            borderRadius: 20,
            boxShadow: "0 0 0 9999px rgba(2,8,23,.72)",
            border: "2px solid #FFD60A",
            zIndex: Z,
            pointerEvents: "none",
            transition: "top .2s, left .2s, width .2s, height .2s",
          }}
        />
        <div
          style={{
            position: "fixed",
            top: Math.min(rect!.bottom + 12, window.innerHeight - 150),
            left: Math.max(12, Math.min(rect!.left, window.innerWidth - 302)),
            zIndex: Z + 1,
          }}
        >
          {tooltip}
        </div>
      </>
    ) : (
      // Fallback: se o card não está visível, banner no rodapé
      <div
        style={{ position: "fixed", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", padding: "0 16px", zIndex: Z + 1 }}
      >
        {tooltip}
      </div>
    ),
    document.body,
  );
}
