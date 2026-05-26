import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useNavigate } from "react-router-dom";

// ─── ModuleUnlockedOverlay ──────────────────────────────────────────────────
// Overlay cinematográfico que dispara 1x quando a aluna entra na área de
// membros e tem um módulo NOVO desbloqueado (que ela ainda não viu).
//
// Sensação visada: tipo passar de fase em videogame. Sequência de eventos:
//   1. Tela escurece (backdrop com blur)
//   2. Raios de luz amarelos radiam do centro (rotação infinita)
//   3. Capa do curso flutua pra dentro com bounce + glow dourado
//   4. Texto "🎉 NOVO MÓDULO DESBLOQUEADO!" sobe com spring + scale
//   5. Confetti dourado explode dos cantos
//   6. Nome do módulo grande aparece
//   7. Botão "Acessar agora" pulsa em loop
//   8. User clica → vai pra biblioteca / curso direto
// =============================================================================

interface ModuleUnlockedProps {
  /** Nome do curso desbloqueado (mostrado bem grande) */
  courseName: string;
  /** URL da capa do curso (9:16) — se não vier, usa fallback */
  coverUrl?: string | null;
  /** ID do curso pra navegar quando clicar em "Acessar agora" */
  courseId?: string | null;
  /** Disparado quando user fecha (clica em "Acessar" ou no X) */
  onClose: () => void;
}

export function ModuleUnlockedOverlay({
  courseName,
  coverUrl,
  courseId,
  onClose,
}: ModuleUnlockedProps) {
  const nav = useNavigate();
  const [showButton, setShowButton] = useState(false);

  // Dispara confetti dourado em ondas
  useEffect(() => {
    const colors = ["#FFD60A", "#FFC700", "#FFAA00", "#FFFFFF"];
    // Onda 1: explosão central
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5, x: 0.5 },
      colors,
      ticks: 200,
      gravity: 0.7,
      zIndex: 10001,
    });
    // Onda 2: canto esquerdo (após 300ms)
    const t1 = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7, x: 0.1 },
        angle: 60,
        colors,
        zIndex: 10001,
      });
    }, 300);
    // Onda 3: canto direito (após 500ms)
    const t2 = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7, x: 0.9 },
        angle: 120,
        colors,
        zIndex: 10001,
      });
    }, 500);
    // Botão aparece um pouquinho depois pra dar respiro
    const t3 = setTimeout(() => setShowButton(true), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  function handleAcessar() {
    onClose();
    if (courseId) nav(`/curso/${courseId}`);
    else nav("/biblioteca");
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center px-4"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        {/* Backdrop escuro com radial gradient amarelado no centro */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,214,10,0.20) 0%, rgba(11,26,56,0.95) 40%, rgba(0,0,0,0.98) 100%)",
          }}
        />

        {/* Raios de luz radiando do centro (rotação contínua) */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45, rotate: 360 }}
          transition={{
            opacity: { duration: 0.8 },
            rotate: { duration: 18, repeat: Infinity, ease: "linear" },
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "200vmax",
              height: "200vmax",
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(255,214,10,0.35) 8deg, transparent 16deg, transparent 50deg, rgba(255,214,10,0.30) 58deg, transparent 66deg, transparent 100deg, rgba(255,214,10,0.35) 108deg, transparent 116deg, transparent 150deg, rgba(255,214,10,0.30) 158deg, transparent 166deg, transparent 200deg, rgba(255,214,10,0.35) 208deg, transparent 216deg, transparent 250deg, rgba(255,214,10,0.30) 258deg, transparent 266deg, transparent 300deg, rgba(255,214,10,0.35) 308deg, transparent 316deg, transparent 360deg)",
            }}
          />
        </motion.div>

        {/* Pulso suave em loop por trás do conteúdo */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 1.8], opacity: [0, 0.6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
          style={{
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(255,214,10,0.35) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* Botão X discreto no canto pra fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-5 right-5 z-50 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-md"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Conteúdo central */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
          {/* Subtítulo "DESBLOQUEADO" — desce do topo */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 18 }}
            className="mb-3"
          >
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase text-[#FFD60A] bg-[#FFD60A]/10 border border-[#FFD60A]/40 px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm filled-icon">lock_open</span>
              Novo módulo desbloqueado
            </span>
          </motion.div>

          {/* Capa do curso com bounce-in + glow */}
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 140,
              damping: 14,
            }}
            className="relative mb-6"
          >
            {/* Glow ring atrás da capa */}
            <motion.div
              className="absolute -inset-4 rounded-3xl"
              animate={{
                boxShadow: [
                  "0 0 30px 5px rgba(255,214,10,0.4)",
                  "0 0 60px 15px rgba(255,214,10,0.7)",
                  "0 0 30px 5px rgba(255,214,10,0.4)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Capa (9:16) */}
            <div
              className="relative w-40 sm:w-48 aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/40 to-primary/10 border-2 border-[#FFD60A]/60 shadow-2xl"
              style={{ boxShadow: "0 25px 60px -10px rgba(255,214,10,0.5)" }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={courseName}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">
                  🚗
                </div>
              )}
              {/* Brilho diagonal animado por cima */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 1.5,
                  delay: 0.6,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
                style={{
                  background:
                    "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                }}
              />
            </div>
          </motion.div>

          {/* Texto principal "NOVO MÓDULO!" — grande, com spring */}
          <motion.h1
            initial={{ y: 40, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
              delay: 0.7,
              type: "spring",
              stiffness: 180,
              damping: 14,
            }}
            className="text-3xl sm:text-5xl font-black tracking-tight leading-[1] text-white mb-2"
            style={{ textWrap: "balance" }}
          >
            Você desbloqueou
          </motion.h1>

          {/* Nome do curso — amarelo brilhante */}
          <motion.h2
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.95, type: "spring", stiffness: 200, damping: 16 }}
            className="text-2xl sm:text-4xl font-black tracking-tight leading-[1.05] text-[#FFD60A] mb-3"
            style={{
              textWrap: "balance",
              textShadow: "0 0 30px rgba(255,214,10,0.6), 0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            {courseName}!
          </motion.h2>

          {/* Texto auxiliar */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.15 }}
            className="text-sm sm:text-base text-white/80 mb-8 max-w-sm"
            style={{ textWrap: "balance" }}
          >
            Sua jornada acabou de ficar mais completa. Bora dirigir essa fase nova? 🚗💨
          </motion.p>

          {/* Botão "Acessar agora" — pulse em loop */}
          {showButton && (
            <motion.button
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              onClick={handleAcessar}
              className="relative group"
            >
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl bg-[#FFD60A]"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <div className="relative bg-[#FFD60A] text-[#0B1A38] font-black px-8 sm:px-10 py-4 rounded-2xl uppercase tracking-widest text-sm sm:text-base shadow-2xl shadow-[#FFD60A]/40 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined">rocket_launch</span>
                Acessar agora
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
