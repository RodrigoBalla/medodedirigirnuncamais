import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

// ─── CommunityGuide ──────────────────────────────────────────────────────────
// Passo a passo da PRIMEIRA publicação na Comunidade. Leva a aluna a:
//   1) publicar um post no feed  2) publicar um story
// e no fim entrega 50 moedas.
//
// Regras (definidas pelo Balla):
//   • Só aparece pra quem AINDA NÃO publicou.
//   • Pode sair no meio — mas volta a aparecer quando ela retornar.
//   • Depois de concluído (ou pra quem já publicava antes), nunca mais aparece.
//
// O estado mora no localStorage (ver communityGuide.ts) — zero custo de banco.
// =============================================================================

const Z = 2147482000;

export type GuideStep = "intro" | "feed" | "story" | "done";

interface Props {
  step: GuideStep;
  /** Seletor do elemento destacado no passo atual. */
  targetId: string | null;
  onStart: () => void;
  onExit: () => void;
  onFinish: () => void;
}

export function CommunityGuide({ step, targetId, onStart, onExit, onFinish }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Acompanha a posição do alvo (scroll/resize/layout)
  useEffect(() => {
    if (step !== "feed" && step !== "story") { setRect(null); return; }
    const update = () => {
      const el = targetId ? document.getElementById(targetId) : null;
      const r = el?.getBoundingClientRect();
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
  }, [step, targetId]);

  // Rola até o alvo ao trocar de passo
  useEffect(() => {
    if (!targetId) return;
    const t = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [targetId, step]);

  if (typeof document === "undefined") return null;

  // ── Abertura ────────────────────────────────────────────────────────────
  if (step === "intro") {
    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: Z, background: "rgba(2,8,23,.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-primary/40 rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl"
        >
          <div className="text-5xl mb-2">👋</div>
          <h3 className="font-black text-lg text-foreground mb-1">Bora fazer sua primeira publicação?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Te guio em <b className="text-foreground">2 passinhos</b>: um post no feed e um story.
            No fim, <span className="text-yellow-600 font-black">50 moedas 🪙</span> são suas.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onStart}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest hover:opacity-90 transition-opacity"
            >
              Bora! 🚗
            </button>
            <button
              onClick={onExit}
              className="w-full py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Agora não
            </button>
          </div>
        </motion.div>
      </div>,
      document.body,
    );
  }

  // ── Final: recompensa ───────────────────────────────────────────────────
  if (step === "done") {
    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: Z, background: "rgba(2,8,23,.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-primary/40 rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl"
        >
          <div className="text-5xl mb-2">🎉</div>
          <h3 className="font-black text-lg text-foreground mb-1">Você publicou nos dois!</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Post no feed <b className="text-foreground">✓</b> e story <b className="text-foreground">✓</b>.
            Agora é só continuar aparecendo — a turma quer te ver dirigindo. 💛
          </p>
          <button
            onClick={onFinish}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest hover:opacity-90 transition-opacity"
          >
            Receber 50 moedas 🪙
          </button>
        </motion.div>
      </div>,
      document.body,
    );
  }

  // ── Passos com destaque no elemento ─────────────────────────────────────
  const passo = step === "feed" ? 1 : 2;
  const titulo = step === "feed" ? "Passo 1 de 2 · Post no feed" : "Passo 2 de 2 · Seu story";
  const texto =
    step === "feed"
      ? "Escreva algo aqui — uma vitória, um medo ou uma dúvida — e toque em Postar. Pode ser curtinho!"
      : "Agora um story: toque em “Seu story”, escolha uma foto e pronto. Ele some sozinho em 24h.";

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto bg-primary text-primary-foreground rounded-2xl px-4 py-3 shadow-2xl max-w-[300px]"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest bg-primary-foreground/20 px-2 py-0.5 rounded-full">
          {titulo}
        </span>
      </div>
      <p className="text-sm font-bold leading-snug">{texto}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {[1, 2].map((n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === passo ? "w-5 bg-primary-foreground" : "w-1.5 bg-primary-foreground/40"}`} />
          ))}
        </div>
        <button onClick={onExit} className="text-[11px] font-bold underline opacity-90 hover:opacity-100">
          Sair do guia
        </button>
      </div>
    </motion.div>
  );

  const pad = 8;
  return createPortal(
    rect ? (
      <>
        {/* Escurece tudo menos o alvo — sem bloquear o clique nele */}
        <div
          style={{
            position: "fixed",
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 18,
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
            top: Math.min(rect.bottom + 12, window.innerHeight - 160),
            left: Math.max(12, Math.min(rect.left, window.innerWidth - 312)),
            zIndex: Z + 1,
          }}
        >
          {card}
        </div>
      </>
    ) : (
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", padding: "0 16px", zIndex: Z + 1 }}>
        {card}
      </div>
    ),
    document.body,
  );
}
