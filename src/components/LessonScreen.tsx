import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STEPS, CHECKLIST_TASKS } from "@/data/driving-data";
import type { Phase } from "@/data/driving-data";
import { GifIllustration } from "@/components/GifIllustration";

interface LessonScreenProps {
  phase: Phase;
  currentPhase: number;
  lessonStep: number;
  setLessonStep: (step: number) => void;
  quizIndex: number;
  quizTotal: number;
  selected: number | null;
  answered: boolean;
  isRetry: boolean;
  retryQueue: number[];
  onQuizSelect: (i: number) => void;
  onNextQuiz: () => void;
  onBack: () => void;
  lessonProgress: number;
  pressedPedal: string | null;
  setPressedPedal: (p: string | null) => void;
  checkedTasks: Record<string, boolean>;
  toggleTask: (id: string) => void;
  onCompletePhase: () => void;
}

const confettiColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function LessonScreen({
  phase,
  currentPhase,
  lessonStep,
  setLessonStep,
  quizIndex,
  quizTotal,
  selected,
  answered,
  isRetry,
  retryQueue,
  onQuizSelect,
  onNextQuiz,
  onBack,
  lessonProgress,
  pressedPedal,
  setPressedPedal,
  checkedTasks,
  toggleTask,
  onCompletePhase,
}: LessonScreenProps) {
  const tasks = CHECKLIST_TASKS[currentPhase];
  const checkedCount = tasks ? tasks.filter(t => checkedTasks[t.id]).length : 0;
  const allDone = tasks ? checkedCount === tasks.length : false;
  const [showCompletion, setShowCompletion] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary filled-icon text-xl">directions_car</span>
          <span className="font-bold text-sm text-foreground">Medo de dirigir nunca mais</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="material-symbols-outlined text-muted-foreground hover:text-foreground transition-colors text-xl">
            menu
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col w-full px-4 md:px-8 lg:px-12 py-6">
        {/* Module bar */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Módulo Atual</p>
              <h2 className="text-base font-bold text-foreground">{phase.title.replace(/Fase \d+ — /, "")}</h2>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-primary">Confiança {Math.round(lessonProgress)}%</span>
              <p className="text-[10px] text-muted-foreground font-medium">Nível de Progresso</p>
            </div>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${lessonProgress}%` }}
            />
          </div>
        </div>

        {/* MISSION */}
        {lessonStep === 0 && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">{phase.title}</h2>
            <p className="text-muted-foreground text-sm mb-6">Objetivo: {phase.subtitle}</p>

            <div className="flex flex-col gap-0 mb-6">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      i < lessonStep ? "bg-primary text-primary-foreground" : i === lessonStep ? "bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--blue-200))]" : "bg-muted text-muted-foreground"
                    }`}>
                      {i < lessonStep ? "✓" : s.icon}
                    </div>
                    {i < STEPS.length - 1 && <div className="w-0.5 min-h-[20px] bg-border my-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="font-bold text-sm text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.key === 0 && "Entenda o que vamos praticar"}
                      {s.key === 1 && `${phase.quizzes.length} perguntas rápidas`}
                      {s.key === 2 && "Visualize o movimento mental"}
                      {s.key === 3 && "Execute no carro real"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-sm text-primary font-medium leading-relaxed mb-6">
              {currentPhase === 0 && "Nesta fase, o carro deixa de ser uma ameaça e se torna um objeto familiar. 🚗"}
              {currentPhase === 1 && "Aqui está o gargalo da maioria dos alunos: a coordenação motora. ⚙️"}
              {currentPhase === 2 && "Com os pés automatizados, chegou a hora do volante. 🏁"}
            </div>

            <button onClick={() => setLessonStep(1)} className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Começar Missão ▶
            </button>
          </div>
        )}

        {/* QUIZ */}
        {lessonStep === 1 && (
          <div>
            {/* Two-column: video left, quiz right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Video area */}
              <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
                <div className="bg-gradient-to-br from-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] aspect-[9/16] flex items-center justify-center relative">
                  {phase.quizzes[quizIndex].gif ? (
                    <GifIllustration
                      key={`${currentPhase}-${quizIndex}-${isRetry ? "r" : "n"}-${answered ? "a" : "q"}`}
                      gifId={phase.quizzes[quizIndex].gif}
                      alt={phase.quizzes[quizIndex].gifAlt}
                      emoji={phase.quizzes[quizIndex].emoji || "🚗"}
                    />
                  ) : (
                    <span className="text-6xl">🚗</span>
                  )}
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="size-16 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-foreground text-3xl filled-icon">play_arrow</span>
                    </div>
                  </div>
                  {/* Video progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-primary-foreground/80 font-medium">0:15 / 1:45</span>
                      <div className="flex-1 h-1 bg-primary-foreground/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-foreground/80 rounded-full" style={{ width: "14%" }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-2 border-t border-border">
                  <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded">
                    <span className="text-[10px]">FASE</span> APLICAR
                  </span>
                  <span className="material-symbols-outlined text-muted-foreground text-sm">info</span>
                  <span className="text-xs text-muted-foreground">O vídeo reagirá à sua escolha</span>
                </div>
              </div>

              {/* Quiz area */}
              <div className="bg-card rounded-2xl border border-border p-6 md:p-8 flex flex-col shadow-sm">
                {isRetry ? (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-5 self-start"
                  >
                    🔄 Revisão — {retryQueue.length} restante{retryQueue.length !== 1 ? "s" : ""}
                  </motion.span>
                ) : (
                  <p className="text-[11px] font-extrabold text-primary uppercase tracking-[0.2em] mb-1">
                    Pergunta {String(quizIndex + 1).padStart(2, "0")}
                  </p>
                )}

                <h2 className="text-2xl font-extrabold tracking-tight mb-6 text-foreground leading-snug">
                  {phase.quizzes[quizIndex].q}
                </h2>

                <div className="flex flex-col gap-3.5 flex-1">
                  <AnimatePresence mode="wait">
                    {phase.quizzes[quizIndex].opts.map((opt, i) => {
                      const isCorrect = answered && i === phase.quizzes[quizIndex].correct;
                      const isWrong = answered && selected === i && i !== phase.quizzes[quizIndex].correct;
                      const isSelected = selected === i && !answered;
                      const isUnselected = answered && selected !== i && !isCorrect;

                      return (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{
                            opacity: isUnselected ? 0.45 : 1,
                            x: 0,
                            scale: isCorrect ? [1, 1.03, 1] : isWrong ? [1, 0.97, 1] : 1,
                          }}
                          transition={{
                            delay: i * 0.06,
                            duration: 0.3,
                            scale: { duration: 0.4, ease: "easeInOut" },
                          }}
                          whileHover={!answered ? { scale: 1.02, y: -2 } : {}}
                          whileTap={!answered ? { scale: 0.97 } : {}}
                          onClick={() => onQuizSelect(i)}
                          disabled={answered}
                          className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                            isCorrect
                              ? "border-[hsl(var(--green))] bg-[hsl(var(--green-light))] shadow-[0_0_20px_hsl(var(--green)/0.2)]"
                              : isWrong
                              ? "border-destructive bg-destructive/5 shadow-[0_0_20px_hsl(var(--destructive)/0.15)]"
                              : isSelected
                              ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
                              : "border-border bg-card hover:border-primary/60 hover:bg-primary/5 hover:shadow-md"
                          }`}
                        >
                          <div className={`size-11 shrink-0 flex items-center justify-center rounded-xl font-extrabold text-base transition-all ${
                            isCorrect
                              ? "bg-[hsl(var(--green))] text-primary-foreground shadow-lg"
                              : isWrong
                              ? "bg-destructive text-destructive-foreground shadow-lg"
                              : isSelected
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                              : "bg-muted border border-border text-muted-foreground group-hover:text-primary group-hover:border-primary/30 group-hover:bg-primary/10"
                          }`}>
                            {isCorrect ? "✓" : isWrong ? "✗" : ["A", "B", "C", "D"][i]}
                          </div>
                          <p className={`font-semibold text-base flex-1 ${
                            isCorrect ? "text-[hsl(var(--green-dark))] font-bold" : isWrong ? "text-destructive" : "text-foreground"
                          }`}>
                            {opt}
                          </p>
                          {isCorrect && (
                            <motion.span
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className="text-2xl"
                            >
                              🎉
                            </motion.span>
                          )}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Explanation */}
                <AnimatePresence>
                  {answered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className={`mt-5 p-5 rounded-2xl flex items-start gap-3 text-sm font-medium leading-relaxed ${
                        selected === phase.quizzes[quizIndex].correct
                          ? "bg-[hsl(var(--green-light))] text-[hsl(var(--green-dark))] border border-[hsl(var(--green))]/20"
                          : "bg-destructive/5 text-destructive border border-destructive/20"
                      }`}
                    >
                      <span className="text-xl">{selected === phase.quizzes[quizIndex].correct ? "🎉" : "💡"}</span>
                      <div>
                        <p className="text-[15px]">{phase.quizzes[quizIndex].explain}</p>
                        {selected !== phase.quizzes[quizIndex].correct && (
                          <p className="mt-1.5 text-xs font-bold opacity-80">🔄 Essa pergunta voltará para revisão!</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Confirm / Next button */}
                <AnimatePresence>
                  {!answered && selected !== null && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onQuizSelect(selected)}
                      className="w-full mt-5 bg-primary text-primary-foreground font-extrabold py-4 rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2 text-base"
                    >
                      Confirmar Escolha
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                {answered && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onNextQuiz}
                    className="w-full mt-5 bg-primary text-primary-foreground font-extrabold py-4 rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2 text-base"
                  >
                    <span>
                      {isRetry
                        ? (selected === phase.quizzes[quizIndex].correct
                            ? (retryQueue.filter(idx => idx !== quizIndex).length > 0 ? "Próxima Revisão" : "Concluir Revisão ✓")
                            : "Tentar Novamente 🔄")
                        : (quizIndex < quizTotal - 1 ? "Próxima Pergunta →" : "Ir para Simulação →")}
                    </span>
                  </motion.button>
                )}

                {!answered && selected === null && (
                  <p className="text-xs text-muted-foreground text-center mt-5 flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">touch_app</span>
                    Sua resposta determinará o desfecho da situação no vídeo.
                  </p>
                )}
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary">psychology</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Foco Cognitivo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Memorização e associação mecânica dos comandos do veículo.</p>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary">history_edu</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Base Mecânica</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Funcionamento básico do sistema de transmissão manual.</p>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary">videocam_off</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Modo Interativo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Vídeo pausado aguardando sua interação para continuar.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SIMULATION */}
        {lessonStep === 2 && (
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-[0.2em] mb-1">Simulação Mental</p>
              <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-foreground">Visualize o movimento</h2>
              <p className="text-sm text-muted-foreground mb-6">Feche os olhos e imagine cada passo antes de executar.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="bg-gradient-to-br from-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] rounded-2xl p-6 md:p-8 text-primary-foreground mb-6"
            >
              <h3 className="text-lg font-extrabold mb-3">
                {currentPhase === 0 && "🚗 Explorando os Pedais"}
                {currentPhase === 1 && "⚙️ Sequência da Segunda Marcha"}
                {currentPhase === 2 && "🏁 Controle do Volante"}
              </h3>
              <p className="text-sm opacity-80 mb-5">
                {currentPhase === 0 && "Toque em cada pedal. Diga a função em voz alta."}
                {currentPhase === 1 && "Embreagem → marcha → aceleração → soltar embreagem."}
                {currentPhase === 2 && "Carro reto, mãos leves, olhar longe."}
              </p>

              {currentPhase === 0 && (
                <div className="flex gap-3 justify-center">
                  {[{ icon: "🦵", name: "Embreagem", key: "e" }, { icon: "🛑", name: "Freio", key: "f" }, { icon: "▶️", name: "Acelerador", key: "a" }].map(p => (
                    <motion.button
                      key={p.key}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      className={`bg-primary-foreground/10 border border-primary-foreground/20 rounded-2xl p-4 text-center min-w-[80px] transition-all ${pressedPedal === p.key ? "bg-primary/50 scale-95" : "hover:bg-primary-foreground/20"}`}
                      onMouseDown={() => setPressedPedal(p.key)}
                      onMouseUp={() => setPressedPedal(null)}
                      onTouchStart={() => setPressedPedal(p.key)}
                      onTouchEnd={() => setPressedPedal(null)}
                    >
                      <div className="text-3xl">{p.icon}</div>
                      <div className="text-xs font-bold mt-1.5 opacity-90">{p.name}</div>
                    </motion.button>
                  ))}
                </div>
              )}

              {currentPhase === 1 && (
                <div className="flex flex-col gap-2.5">
                  {["1️⃣ Pé esquerdo na embreagem", "2️⃣ Mão na alavanca de câmbio", "3️⃣ Pé direito com aceleração suave", "4️⃣ Soltar embreagem devagar"].map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-primary-foreground/10 rounded-xl p-3.5 text-sm font-semibold"
                    >{step}</motion.div>
                  ))}
                </div>
              )}

              {currentPhase === 2 && (
                <div className="flex flex-col gap-2.5">
                  {["👀 Olhos para longe", "🤲 Mãos leves", "📍 Manter na faixa", "🛣️ Reduzir no quebra-mola"].map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-primary-foreground/10 rounded-xl p-3.5 text-sm font-semibold"
                    >{step}</motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-[hsl(var(--green-light))] rounded-2xl p-5 text-sm text-[hsl(var(--green-dark))] font-medium leading-relaxed border border-[hsl(var(--green))]/20 mb-6 flex items-start gap-3"
            >
              <span className="text-xl">💡</span>
              <p><strong>Por que visualizar?</strong> O cérebro não distingue entre simulação mental e ação real!</p>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setLessonStep(3)}
              className="w-full bg-primary text-primary-foreground font-extrabold py-4 rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2 text-base"
            >
              Ir para Prática Real
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </motion.button>
          </div>
        )}

        {/* PRACTICE */}
        {lessonStep === 3 && (
          <div>
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-[0.2em] mb-1">Prática Real</p>
              <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-foreground">
                {currentPhase === 0 && "Com o carro ligado e parado"}
                {currentPhase === 1 && "Em local aberto — andar poucos metros"}
                {currentPhase === 2 && "Manter faixa e fazer curvas suaves"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">Complete todas as tarefas para concluir a fase.</p>
            </motion.div>

            {/* Two-column: checklist left, video right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: checklist */}
              <div>
                {/* Progress bar */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card rounded-2xl border border-border p-5 mb-6"
                >
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-foreground flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-lg">checklist</span>
                      Progresso da Prática
                    </span>
                    <span className={`text-base font-extrabold ${allDone ? "text-[hsl(var(--green))]" : "text-primary"}`}>{checkedCount}/{tasks.length}</span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(checkedCount / tasks.length) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      style={{ background: allDone ? "hsl(var(--green))" : "hsl(var(--primary))" }}
                    />
                  </div>
                  {allDone && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-bold text-[hsl(var(--green))] mt-2 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">emoji_events</span>
                      Todas as tarefas concluídas! Parabéns!
                    </motion.p>
                  )}
                </motion.div>

                {/* Task list */}
                <div className="flex flex-col gap-3 mb-6">
                  {tasks.map((task, i) => {
                    const isChecked = !!checkedTasks[task.id];
                    return (
                      <motion.button
                        key={task.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggleTask(task.id)}
                        className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left w-full ${
                          isChecked
                            ? "border-[hsl(var(--green))] bg-[hsl(var(--green-light))] shadow-[0_0_16px_hsl(var(--green)/0.15)]"
                            : "border-border bg-card hover:border-primary/50 hover:shadow-md"
                        }`}
                      >
                        <div className={`size-10 shrink-0 rounded-xl border-2 flex items-center justify-center transition-all ${
                          isChecked ? "bg-[hsl(var(--green))] border-[hsl(var(--green))] shadow-lg" : "border-muted-foreground/30 group-hover:border-primary/50"
                        }`}>
                          {isChecked ? (
                            <motion.svg
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                              width="16" height="16" viewBox="0 0 14 14" fill="none"
                            >
                              <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </motion.svg>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs font-bold">{i + 1}</span>
                          )}
                        </div>
                        <span className="text-2xl">{task.icon}</span>
                        <span className={`flex-1 text-base font-semibold ${isChecked ? "line-through opacity-50 text-muted-foreground" : "text-foreground"}`}>{task.text}</span>
                        {isChecked ? (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 15 }}
                            className="text-xs font-extrabold text-[hsl(var(--green))] bg-[hsl(var(--green-light))] rounded-lg px-2.5 py-1 shadow-sm"
                          >
                            +5 XP ✨
                          </motion.span>
                        ) : (
                          <span className="material-symbols-outlined text-muted-foreground/30 text-xl group-hover:text-primary/50 transition-colors">radio_button_unchecked</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Complete celebration */}
                <AnimatePresence>
                  {allDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="flex items-center gap-4 bg-[hsl(var(--green-light))] border-2 border-[hsl(var(--green))]/30 rounded-2xl p-5 mb-6 shadow-[0_0_24px_hsl(var(--green)/0.15)]"
                    >
                      <motion.span
                        animate={{ rotate: [0, -10, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
                        className="text-3xl"
                      >🎉</motion.span>
                      <div>
                        <p className="font-extrabold text-base text-foreground">Prática concluída!</p>
                        <p className="text-sm text-muted-foreground">Você desbloqueou +25 XP de bônus! 🏆</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <motion.button
                  whileHover={allDone ? { scale: 1.02 } : {}}
                  whileTap={allDone ? { scale: 0.97 } : {}}
                  onClick={onCompletePhase}
                  disabled={!allDone}
                  className={`w-full bg-primary text-primary-foreground font-extrabold py-4 rounded-2xl transition-colors shadow-lg shadow-primary/25 text-base ${!allDone ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/90"}`}
                >
                  🎉 Concluir Fase!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLessonStep(2)}
                  className="w-full mt-3 bg-card text-primary border-2 border-primary/20 font-bold py-3.5 rounded-2xl hover:bg-primary/5 transition-colors text-sm"
                >
                  ← Rever Simulação
                </motion.button>
              </div>

              {/* Right: Video 9:16 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col lg:sticky lg:top-6 self-start"
              >
                <div className="bg-gradient-to-br from-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] aspect-[9/16] flex items-center justify-center relative">
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="size-16 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-primary-foreground text-3xl filled-icon">play_arrow</span>
                    </motion.div>
                  </div>
                  {/* Video label */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg">
                      Aula Prática
                    </span>
                  </div>
                  {/* Video progress */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-primary-foreground/80 font-medium">0:00 / 3:20</span>
                      <div className="flex-1 h-1 bg-primary-foreground/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-foreground/80 rounded-full" style={{ width: "0%" }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-border">
                  <p className="text-sm font-bold text-foreground mb-1">
                    {currentPhase === 0 && "Demonstração: Conhecendo os pedais"}
                    {currentPhase === 1 && "Demonstração: Troca de marcha"}
                    {currentPhase === 2 && "Demonstração: Controle do volante"}
                  </p>
                  <p className="text-xs text-muted-foreground">Assista enquanto completa as tarefas ao lado.</p>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">© 2026 Medo de dirigir nunca mais - Sistema de Aprendizado Prático</p>
      </footer>
    </div>
  );
}
