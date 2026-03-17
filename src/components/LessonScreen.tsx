import { useState } from "react";
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
                <div className="bg-gradient-to-br from-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] aspect-[4/5] lg:aspect-auto lg:flex-1 flex items-center justify-center relative min-h-[280px]">
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
              <div className="bg-card rounded-xl border border-border p-5 md:p-6 flex flex-col">
                {isRetry ? (
                  <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-bold uppercase mb-4 self-start">
                    🔄 Revisão — {retryQueue.length} restante{retryQueue.length !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Pergunta {String(quizIndex + 1).padStart(2, "0")}
                  </p>
                )}

                <h2 className="text-xl font-bold tracking-tight mb-5 text-foreground">
                  {phase.quizzes[quizIndex].q}
                </h2>

                <div className="flex flex-col gap-3 flex-1">
                  {phase.quizzes[quizIndex].opts.map((opt, i) => {
                    const isCorrect = answered && i === phase.quizzes[quizIndex].correct;
                    const isWrong = answered && selected === i && i !== phase.quizzes[quizIndex].correct;

                    return (
                      <button
                        key={i}
                        onClick={() => onQuizSelect(i)}
                        className={`group flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                          isCorrect
                            ? "border-[hsl(var(--green))] bg-[hsl(var(--green-light))]"
                            : isWrong
                            ? "border-destructive bg-destructive/5"
                            : selected === i && !answered
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        <div className={`size-9 shrink-0 flex items-center justify-center rounded-lg font-bold text-sm ${
                          isCorrect
                            ? "bg-[hsl(var(--green))] text-primary-foreground"
                            : isWrong
                            ? "bg-destructive text-destructive-foreground"
                            : selected === i && !answered
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted border border-border text-muted-foreground group-hover:text-primary group-hover:border-primary/30"
                        }`}>
                          {["A", "B", "C", "D"][i]}
                        </div>
                        <p className={`font-medium text-sm ${
                          isCorrect ? "text-[hsl(var(--green-dark))] font-bold" : isWrong ? "text-destructive" : "text-foreground"
                        }`}>
                          {opt}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {answered && (
                  <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 text-sm font-medium leading-relaxed ${
                    selected === phase.quizzes[quizIndex].correct
                      ? "bg-[hsl(var(--green-light))] text-[hsl(var(--green-dark))] border border-[hsl(var(--green))]/20"
                      : "bg-destructive/5 text-destructive border border-destructive/20"
                  }`}>
                    <span className="text-lg">{selected === phase.quizzes[quizIndex].correct ? "🎉" : "💡"}</span>
                    <div>
                      <p>{phase.quizzes[quizIndex].explain}</p>
                      {selected !== phase.quizzes[quizIndex].correct && (
                        <p className="mt-1 text-xs font-bold opacity-80">🔄 Essa pergunta voltará para revisão!</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Confirm / Next button */}
                {!answered && selected !== null && (
                  <button onClick={() => onQuizSelect(selected)} className="w-full mt-4 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    Confirmar Escolha
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}

                {answered && (
                  <button onClick={onNextQuiz} className="w-full mt-4 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <span>
                      {isRetry
                        ? (selected === phase.quizzes[quizIndex].correct
                            ? (retryQueue.filter(idx => idx !== quizIndex).length > 0 ? "Próxima Revisão" : "Concluir Revisão ✓")
                            : "Tentar Novamente 🔄")
                        : (quizIndex < quizTotal - 1 ? "Próxima Pergunta" : "Ir para Simulação")}
                    </span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}

                {!answered && selected === null && (
                  <p className="text-xs text-muted-foreground text-center mt-4">Sua resposta determinará o desfecho da situação no vídeo.</p>
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
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">Visualize o movimento</h2>
            <p className="text-sm text-muted-foreground mb-6">Feche os olhos e imagine cada passo antes de executar.</p>

            <div className="bg-gradient-to-br from-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] rounded-xl p-6 text-primary-foreground mb-6">
              <h3 className="text-lg font-bold mb-3">
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
                    <button
                      key={p.key}
                      className={`bg-primary-foreground/10 border border-primary-foreground/20 rounded-xl p-3 text-center min-w-[70px] transition-all ${pressedPedal === p.key ? "bg-primary/50 scale-95" : "hover:bg-primary-foreground/20"}`}
                      onMouseDown={() => setPressedPedal(p.key)}
                      onMouseUp={() => setPressedPedal(null)}
                      onTouchStart={() => setPressedPedal(p.key)}
                      onTouchEnd={() => setPressedPedal(null)}
                    >
                      <div className="text-2xl">{p.icon}</div>
                      <div className="text-xs font-bold mt-1 opacity-90">{p.name}</div>
                    </button>
                  ))}
                </div>
              )}

              {currentPhase === 1 && (
                <div className="flex flex-col gap-2">
                  {["1️⃣ Pé esquerdo na embreagem", "2️⃣ Mão na alavanca de câmbio", "3️⃣ Pé direito com aceleração suave", "4️⃣ Soltar embreagem devagar"].map((step, i) => (
                    <div key={i} className="bg-primary-foreground/10 rounded-lg p-2.5 text-sm font-medium">{step}</div>
                  ))}
                </div>
              )}

              {currentPhase === 2 && (
                <div className="flex flex-col gap-2">
                  {["👀 Olhos para longe", "🤲 Mãos leves", "📍 Manter na faixa", "🛣️ Reduzir no quebra-mola"].map((step, i) => (
                    <div key={i} className="bg-primary-foreground/10 rounded-lg p-2.5 text-sm font-medium">{step}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[hsl(var(--green-light))] rounded-xl p-4 text-sm text-[hsl(var(--green-dark))] font-medium leading-relaxed border border-[hsl(var(--green))]/20 mb-6">
              💡 <strong>Por que visualizar?</strong> O cérebro não distingue entre simulação mental e ação real!
            </div>

            <button onClick={() => setLessonStep(3)} className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
              Ir para Prática Real
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        )}

        {/* PRACTICE */}
        {lessonStep === 3 && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
              {currentPhase === 0 && "Com o carro ligado e parado"}
              {currentPhase === 1 && "Em local aberto — andar poucos metros"}
              {currentPhase === 2 && "Manter faixa e fazer curvas suaves"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Complete todas as tarefas para concluir a fase.</p>

            <div className="mb-5">
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-muted-foreground">Progresso</span>
                <span className={allDone ? "text-[hsl(var(--green))]" : "text-primary"}>{checkedCount}/{tasks.length}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${(checkedCount / tasks.length) * 100}%`,
                  background: allDone ? "hsl(var(--green))" : "hsl(var(--primary))"
                }} />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mb-5">
              {tasks.map((task) => {
                const isChecked = !!checkedTasks[task.id];
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left w-full ${
                      isChecked ? "border-[hsl(var(--green))] bg-[hsl(var(--green-light))]" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className={`size-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isChecked ? "bg-[hsl(var(--green))] border-[hsl(var(--green))]" : "border-muted-foreground/30"
                    }`}>
                      {isChecked && (
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-lg">{task.icon}</span>
                    <span className={`flex-1 text-sm font-medium ${isChecked ? "line-through opacity-60 text-muted-foreground" : "text-foreground"}`}>{task.text}</span>
                    {isChecked && <span className="text-xs font-bold text-[hsl(var(--green))] bg-[hsl(var(--green-light))] rounded px-1.5 py-0.5">+5 XP</span>}
                  </button>
                );
              })}
            </div>

            {allDone && (
              <div className="flex items-center gap-3 bg-[hsl(var(--green-light))] border border-[hsl(var(--green))]/20 rounded-xl p-4 mb-5">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="font-bold text-sm text-foreground">Prática concluída!</p>
                  <p className="text-xs text-muted-foreground">Todas as tarefas completadas.</p>
                </div>
              </div>
            )}

            <button
              onClick={onCompletePhase}
              disabled={!allDone}
              className={`w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-primary/20 ${!allDone ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90"}`}
            >
              🎉 Concluir Fase!
            </button>
            <button
              onClick={() => setLessonStep(2)}
              className="w-full mt-2 bg-card text-primary border-2 border-primary/20 font-bold py-3 rounded-xl hover:bg-primary/5 transition-colors"
            >
              ← Rever Simulação
            </button>
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
