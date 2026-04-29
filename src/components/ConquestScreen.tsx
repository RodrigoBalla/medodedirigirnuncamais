import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Phase } from "@/data/driving-data";
import { playChestSound, playCoinSound, playCelebrationSound } from "@/lib/sounds";

interface ConquestScreenProps {
  phase: Phase;
  completedPhases: number[];
  onDashboard: () => void;
  onNextLesson: () => void;
  totalPhases: number;
  onEmotionSubmit: (tension: number, confidence: number) => void;
  phaseIndex: number;
}

const CHEST_REWARDS = [
  { type: "coins", amount: 30, label: "+30 Moedas", icon: "paid", color: "text-yellow-500" },
  { type: "coins", amount: 50, label: "+50 Moedas", icon: "paid", color: "text-yellow-500" },
  { type: "coins", amount: 100, label: "+100 Moedas!", icon: "diamond", color: "text-cyan-400" },
  { type: "xp", amount: 25, label: "+25 XP Bônus", icon: "bolt", color: "text-purple-500" },
  { type: "life", amount: 1, label: "+1 Vida Extra", icon: "favorite", color: "text-red-500" },
];

export function ConquestScreen({
  phase,
  completedPhases,
  onDashboard,
  onNextLesson,
  totalPhases,
  onEmotionSubmit,
}: ConquestScreenProps) {
  const [showEmotion, setShowEmotion] = useState(false);
  const [tensionVal, setTensionVal] = useState<number | null>(null);
  const [confVal, setConfVal] = useState<number | null>(null);
  const [chestOpened, setChestOpened] = useState(false);
  const [chestShaking, setChestShaking] = useState(true);

  const reward = useMemo(() => CHEST_REWARDS[Math.floor(Math.random() * CHEST_REWARDS.length)], []);

  const handleOpenChest = () => {
    playChestSound();
    setChestShaking(false);
    setTimeout(() => {
      setChestOpened(true);
      playCoinSound();
      setTimeout(() => playCelebrationSound(), 400);
    }, 600);
  };

  if (showEmotion) {
    return (
      <div className="mt-10">
        <h2 className="text-xl font-bold text-center mb-2">Como você se sente agora? 💭</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Sua percepção emocional é parte do aprendizado.
        </p>
        <p className="text-sm font-bold text-muted-foreground mb-2">😰 Nível de tensão</p>
        <div className="flex gap-2 mb-6">
          {[
            { emoji: "😌", label: "Nada" },
            { emoji: "😐", label: "Pouca" },
            { emoji: "😟", label: "Média" },
            { emoji: "😰", label: "Alta" },
            { emoji: "😱", label: "Muita" },
          ].map((item, i) => (
            <button
              key={i}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                tensionVal === i
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
              onClick={() => setTensionVal(i)}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm font-bold text-muted-foreground mb-2">💪 Nível de confiança</p>
        <div className="flex gap-2 mb-6">
          {[
            { emoji: "😟", label: "Nada" },
            { emoji: "😐", label: "Pouca" },
            { emoji: "🙂", label: "Média" },
            { emoji: "😊", label: "Alta" },
            { emoji: "🤩", label: "Total" },
          ].map((item, i) => (
            <button
              key={i}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                confVal === i
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
              onClick={() => setConfVal(i)}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>
        <button
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
          disabled={tensionVal === null || confVal === null}
          onClick={() => {
            if (tensionVal !== null && confVal !== null) {
              onEmotionSubmit(tensionVal, confVal);
              setShowEmotion(false);
              onDashboard();
            }
          }}
        >
          Salvar e Continuar →
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden min-h-[500px]">
      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -20, x: Math.random() * 400, opacity: 1, rotate: 0 }}
            animate={{ y: 600, rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
            transition={{ duration: 2 + Math.random() * 3, delay: Math.random() * 1.5, ease: "linear" }}
            style={{
              position: "absolute",
              width: 8 + Math.random() * 6,
              height: 8 + Math.random() * 6,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              background: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][i % 6],
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Victory Header */}
        <div className="bg-gradient-to-br from-primary via-blue-600 to-purple-700 rounded-[32px] p-8 text-center text-primary-foreground shadow-2xl mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_70%)]" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 10. }}
            className="text-7xl mb-3"
          >
            🏆
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl mb-2"
          >
            ⭐⭐⭐
          </motion.div>
          <h2 className="text-3xl font-black uppercase italic tracking-tight mb-2">Fase Concluída!</h2>
          <p className="text-sm opacity-80 mb-4">{phase.conquest}</p>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl py-3 px-6 text-xl font-black inline-block border border-white/10">
            +{phase.xp} XP ganhos! ⚡
          </div>
        </div>

        {/* Mystery Chest */}
        <div className="bg-card rounded-[32px] border border-border p-8 text-center mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Recompensa Misteriosa
          </p>

          <AnimatePresence mode="wait">
            {!chestOpened ? (
              <motion.div key="closed" exit={{ scale: 0, rotate: 20 }}>
                <motion.button
                  id="onboarding-collect-reward"
                  onClick={handleOpenChest}
                  animate={chestShaking ? { rotate: [-3, 3, -3, 3, 0], y: [0, -4, 0] } : { scale: [1, 1.3, 0] }}
                  transition={chestShaking ? { duration: 0.5, repeat: Infinity, repeatDelay: 1 } : { duration: 0.6 }}
                  className="text-8xl cursor-pointer mx-auto block hover:drop-shadow-[0_0_20px_rgba(250,204,21,0.5)] transition-all"
                >
                  🎁
                </motion.button>
                <p className="text-xs font-bold text-muted-foreground mt-4 animate-pulse">
                  Toque para abrir seu baú!
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="opened"
                initial={{ scale: 0, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="py-4"
              >
                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent pointer-events-none" />
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className={`material-symbols-outlined text-6xl filled-icon ${reward.color} drop-shadow-lg`}>
                    {reward.icon}
                  </span>
                </motion.div>
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-black mt-4 uppercase italic tracking-tight"
                >
                  {reward.label}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-xs text-muted-foreground mt-2"
                >
                  Bônus adicionado à sua conta!
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            className="w-full bg-card text-primary font-black py-4 rounded-2xl border border-border hover:bg-accent transition-colors shadow-sm text-sm uppercase tracking-widest"
            onClick={() => setShowEmotion(true)}
          >
            Como me sinto agora? 💭
          </button>
          {completedPhases.length < totalPhases ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl shadow-lg shadow-primary/30 text-sm uppercase tracking-widest italic"
              onClick={onNextLesson}
            >
              Próxima Fase →
            </motion.button>
          ) : (
            <button
              className="w-full bg-accent text-accent-foreground font-black py-4 rounded-2xl border border-border text-sm uppercase tracking-widest"
              onClick={onDashboard}
            >
              Voltar ao Dashboard 🏠
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
