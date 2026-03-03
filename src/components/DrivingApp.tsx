import { useState, useEffect, useCallback } from "react";
import "@/styles/driving-app.css";
import { PHASES, FUTURE_PHASES, ACHIEVEMENTS, CHECKLIST_TASKS, STEPS } from "@/data/driving-data";
import { GifIllustration } from "@/components/GifIllustration";
import { ConquestScreen } from "@/components/ConquestScreen";
import {
  playCorrectSound,
  playWrongSound,
  playCheckSound,
  playAllDoneSound,
  playConquestSound,
} from "@/lib/sounds";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { WelcomeBackScreen } from "@/components/WelcomeBackScreen";

type Screen = "welcome" | "welcome-back" | "dashboard" | "lesson" | "conquest";

const DrivingApp = () => {
  const { user, signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("driving-dark-mode") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("driving-dark-mode", String(darkMode));
  }, [darkMode]);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [welcomeVideoViews, setWelcomeVideoViews] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [lessonStep, setLessonStep] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [totalXP, setTotalXP] = useState(120);
  const [confidence, setConfidence] = useState(3);
  const [displayName, setDisplayName] = useState("");
  const [pressedPedal, setPressedPedal] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [retryQueue, setRetryQueue] = useState<number[]>([]);
  const [isRetry, setIsRetry] = useState(false);
  const [emotionHistory] = useState([
    { conf: 2, tens: 4 }, { conf: 3, tens: 3 }, { conf: 3, tens: 2 }, { conf: 4, tens: 2 }, { conf: 4, tens: 1 }
  ]);

  // Load progress from database
  useEffect(() => {
    if (!user) return;
    const loadProgress = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      if (profile) setDisplayName(profile.display_name || user.user_metadata?.display_name || "");

      const { data: progress } = await supabase
        .from("user_progress")
        .select("completed_phases, total_xp, confidence, welcome_video_views")
        .eq("user_id", user.id)
        .single();
      if (progress) {
        setCompletedPhases(progress.completed_phases || []);
        setTotalXP(progress.total_xp || 120);
        setConfidence(progress.confidence || 3);
        const views = progress.welcome_video_views ?? 0;
        setWelcomeVideoViews(views);
        if (views === 0) {
          setScreen("welcome");
        } else {
          setScreen("welcome-back");
        }
      } else {
        setWelcomeVideoViews(0);
        setScreen("welcome");
      }
    };
    loadProgress();
  }, [user]);

  // Save progress to database
  const saveProgress = useCallback(async (phases: number[], xp: number, conf: number) => {
    if (!user) return;
    await supabase
      .from("user_progress")
      .update({ completed_phases: phases, total_xp: xp, confidence: conf })
      .eq("user_id", user.id);
  }, [user]);

  const phase = PHASES[currentPhase];
  const quizTotal = phase ? phase.quizzes.length : 0;
  const overallProgress = Math.round((completedPhases.length / PHASES.length) * 100);

  function startLesson(idx: number) {
    if (idx > completedPhases.length) return;
    setCurrentPhase(idx);
    setLessonStep(0);
    setQuizIndex(0);
    setSelected(null);
    setAnswered(false);
    setCheckedTasks({});
    setRetryQueue([]);
    setIsRetry(false);
    setScreen("lesson");
  }

  function toggleTask(taskId: string) {
    const wasChecked = checkedTasks[taskId];
    setCheckedTasks(prev => ({ ...prev, [taskId]: !wasChecked }));
    if (!wasChecked) {
      const tasks = CHECKLIST_TASKS[currentPhase];
      const newChecked = { ...checkedTasks, [taskId]: true };
      const allDone = tasks.every(t => newChecked[t.id]);
      if (allDone) playAllDoneSound();
      else playCheckSound();
    }
  }

  function handleQuizSelect(i: number) {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    if (i === phase.quizzes[quizIndex].correct) {
      if (!isRetry) setTotalXP(x => x + 10);
      playCorrectSound();
    } else {
      playWrongSound();
      if (!isRetry) {
        setRetryQueue(q => q.includes(quizIndex) ? q : [...q, quizIndex]);
      }
    }
  }

  function nextQuiz() {
    const wasCorrect = selected === phase.quizzes[quizIndex].correct;
    if (!isRetry) {
      if (quizIndex < quizTotal - 1) {
        setQuizIndex(q => q + 1);
        setSelected(null);
        setAnswered(false);
      } else {
        const finalQueue = wasCorrect ? retryQueue : [...new Set([...retryQueue, quizIndex])];
        if (finalQueue.length > 0) {
          setRetryQueue(finalQueue);
          setIsRetry(true);
          setQuizIndex(finalQueue[0]);
          setSelected(null);
          setAnswered(false);
        } else {
          setLessonStep(2);
        }
      }
    } else {
      if (wasCorrect) {
        const remaining = retryQueue.filter(idx => idx !== quizIndex);
        if (remaining.length > 0) {
          setRetryQueue(remaining);
          setQuizIndex(remaining[0]);
          setSelected(null);
          setAnswered(false);
        } else {
          setRetryQueue([]);
          setIsRetry(false);
          setLessonStep(2);
        }
      } else {
        const remaining = retryQueue.filter(idx => idx !== quizIndex);
        const reQueued = [...remaining, quizIndex];
        setRetryQueue(reQueued);
        setQuizIndex(reQueued[0]);
        setSelected(null);
        setAnswered(false);
      }
    }
  }

  function completePhase() {
    if (!completedPhases.includes(currentPhase)) {
      const newPhases = [...completedPhases, currentPhase];
      const newXP = totalXP + phase.xp;
      const newConf = 4;
      setCompletedPhases(newPhases);
      setTotalXP(newXP);
      setConfidence(newConf);
      playConquestSound();
      saveProgress(newPhases, newXP, newConf);
    }
    setScreen("conquest");
  }

  function submitEmotion(_tensionVal: number, confVal: number) {
    setConfidence(confVal || 4);
  }

  async function handleWelcomeComplete() {
    const newViews = (welcomeVideoViews ?? 0) + 1;
    setWelcomeVideoViews(newViews);
    setScreen("dashboard");
    if (user) {
      await supabase
        .from("user_progress")
        .update({ welcome_video_views: newViews })
        .eq("user_id", user.id);
    }
  }

  function lessonProgress() {
    if (lessonStep === 0) return 5;
    if (lessonStep === 1) return 20 + (quizIndex / quizTotal) * 30;
    if (lessonStep === 2) return 60;
    if (lessonStep === 3) return 90;
    return 100;
  }

  if (welcomeVideoViews === null) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        color: "white",
        fontSize: "1.2rem",
        fontWeight: 700,
      }}>
        🚘 Carregando...
      </div>
    );
  }

  if (screen === "welcome") {
    return (
      <WelcomeScreen
        displayName={displayName}
        videoViews={welcomeVideoViews}
        onComplete={handleWelcomeComplete}
      />
    );
  }

  if (screen === "welcome-back") {
    return (
      <WelcomeBackScreen
        displayName={displayName}
        onWatchVideo={() => setScreen("welcome")}
        onContinue={() => setScreen("dashboard")}
      />
    );
  }

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-logo">
          🚘 <span>Medo de Dirigir</span> Nunca Mais
        </div>
        <div className="topbar-stats">
          <div className="stat-chip"><span className="icon">⚡</span>{totalXP} XP</div>
          <div className="stat-chip"><span className="icon">💙</span>{confidence}/5</div>
          <div className="stat-chip"><span className="icon">🏅</span>{completedPhases.length} fases</div>
          <button
            className="stat-chip"
            onClick={() => setDarkMode(d => !d)}
            style={{ cursor: "pointer", border: "none" }}
            title={darkMode ? "Modo claro" : "Modo escuro"}
          >
            <span className="icon">{darkMode ? "☀️" : "🌙"}</span>
          </button>
          {displayName && (
            <div className="stat-chip" style={{ fontWeight: 700 }}>
              <span className="icon">👤</span>{displayName}
            </div>
          )}
          <button
            className="stat-chip"
            onClick={signOut}
            style={{ cursor: "pointer", border: "none", color: "#ef4444" }}
            title="Sair"
          >
            <span className="icon">🚪</span> Sair
          </button>
        </div>
      </div>

      <div className="main">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-title">Menu</div>
          <div className={`sidebar-item ${screen === "dashboard" ? "active" : ""}`} onClick={() => setScreen("dashboard")}>
            <span className="s-icon">🏠</span> Dashboard
          </div>
          <div className="sidebar-title">Fases</div>
          {PHASES.map((p, i) => (
            <div
              key={p.id}
              className={`sidebar-item ${currentPhase === i && screen === "lesson" ? "active" : ""}`}
              onClick={() => startLesson(i)}
            >
              <span className="s-icon">{p.icon}</span>
              <span style={{ fontSize: "0.82rem" }}>Fase {p.id}</span>
              {completedPhases.includes(i) && <span style={{ marginLeft: "auto", color: "hsl(var(--green))" }}>✓</span>}
              {i > completedPhases.length && <span style={{ marginLeft: "auto", fontSize: "0.75rem" }}>🔒</span>}
            </div>
          ))}
          <div className="sidebar-title" style={{ marginTop: 8 }}>Em breve</div>
          {FUTURE_PHASES.map((f, i) => (
            <div key={i} className="sidebar-item" style={{ opacity: 0.5, cursor: "not-allowed" }}>
              <span className="s-icon">{f.icon}</span>
              <span style={{ fontSize: "0.82rem" }}>{f.title}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.75rem" }}>🔒</span>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div className="content">

          {/* DASHBOARD */}
          {screen === "dashboard" && (
            <div>
              <div className="dashboard-header">
                <h1>Olá, {displayName || "Motorista"}! 👋</h1>
                <p>Continue sua jornada rumo à confiança total ao volante.</p>
              </div>

              <div className="dashboard-grid">
                <div className="card-driving">
                  <div className="card-title-driving">📈 Progresso Geral</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${overallProgress}%` }} />
                      </div>
                      <div className="progress-label">
                        <span>{completedPhases.length} de {PHASES.length} fases</span>
                        <span>{overallProgress}%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                    <div className="road-sign">🚗 {totalXP} XP total</div>
                  </div>
                </div>

                <div className="card-driving">
                  <div className="card-title-driving">😊 Evolução Emocional</div>
                  <div className="mini-chart">
                    {emotionHistory.map((e, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div className="chart-bar conf" style={{ height: `${e.conf * 10}px`, width: "100%" }} />
                        <div className="chart-bar tens" style={{ height: `${e.tens * 10}px`, width: "100%" }} />
                      </div>
                    ))}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div className="chart-bar conf" style={{ height: `${confidence * 10}px`, width: "100%" }} />
                    </div>
                  </div>
                  <div className="chart-legend">
                    <div className="legend-item"><div className="legend-dot" style={{ background: "hsl(var(--blue-400))" }} />Confiança</div>
                    <div className="legend-item"><div className="legend-dot" style={{ background: "hsl(var(--red))" }} />Tensão</div>
                  </div>
                </div>

                <div className="card-driving card-full" style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(224 76% 48%))", color: "white", border: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", opacity: 0.7, marginBottom: 6 }}>
                        Próxima Missão
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800, marginBottom: 4 }}>
                        {completedPhases.length < PHASES.length
                          ? PHASES[completedPhases.length].title
                          : "🎉 Todas as fases concluídas!"}
                      </div>
                      {completedPhases.length < PHASES.length && (
                        <div style={{ opacity: 0.8, fontSize: "0.9rem" }}>
                          {PHASES[completedPhases.length].subtitle}
                        </div>
                      )}
                    </div>
                    {completedPhases.length < PHASES.length && (
                      <button
                        className="continue-btn-big"
                        style={{ background: "white", color: "#1d4ed8" }}
                        onClick={() => startLesson(completedPhases.length)}
                      >
                        ▶ Continuar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="section-title">🗺️ Trilha de Aprendizado</div>
              <div className="phases-row">
                {PHASES.map((p, i) => {
                  const done = completedPhases.includes(i);
                  const isCurrent = i === completedPhases.length;
                  const locked = i > completedPhases.length;
                  return (
                    <div
                      key={p.id}
                      className={`phase-card ${locked ? "locked" : ""} ${isCurrent ? "active-phase" : ""}`}
                      onClick={() => !locked && startLesson(i)}
                    >
                      <div className="phase-header">
                        <div className={`phase-icon ${locked ? "locked-bg" : p.iconBg}`}>
                          {locked ? "🔒" : p.icon}
                        </div>
                        <div className="phase-info">
                          <div className="phase-title">{p.title}</div>
                          <div className="phase-subtitle">{p.subtitle} • {p.xp} XP</div>
                        </div>
                        <div className={`phase-badge ${done ? "badge-done" : isCurrent ? "badge-current" : "badge-locked"}`}>
                          {done ? "✓ Completo" : isCurrent ? "▶ Atual" : "🔒 Bloqueado"}
                        </div>
                      </div>
                      <div className="phase-steps">
                        {p.steps.map((_, si) => (
                          <div key={si} className={`phase-step ${done ? "done" : isCurrent && si === 0 ? "active-step" : ""}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {FUTURE_PHASES.map((f, i) => (
                  <div key={i} className="phase-card locked">
                    <div className="phase-header">
                      <div className="phase-icon locked-bg" style={{ fontSize: "1.5rem" }}>🔒</div>
                      <div className="phase-info">
                        <div className="phase-title">{f.icon} {f.title}</div>
                        <div className="phase-subtitle">{f.desc}</div>
                      </div>
                      <div className="phase-badge badge-locked">Em breve</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card-driving" style={{ marginTop: 4 }}>
                <div className="card-title-driving">🏆 Conquistas</div>
                <div className="achievements-grid">
                  {ACHIEVEMENTS.map((a, i) => (
                    <div key={i} className={`achievement ${a.unlocked ? "unlocked" : "locked"}`}>
                      <div className="ach-icon">{a.icon}</div>
                      <div className={a.unlocked ? "ach-name" : "ach-name-locked"}>{a.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-driving" style={{ marginTop: 16 }}>
                <div className="card-title-driving">🧠 Lembre-se</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="road-deco">🔵 Medo = falta de previsibilidade</div>
                  <div className="road-deco">🟢 Treino em etapas = cérebro cria mapa motor</div>
                  <div className="road-deco">⭐ Mapa motor = confiança automática</div>
                </div>
              </div>
            </div>
          )}

          {/* LESSON */}
          {screen === "lesson" && phase && (
            <div>
              <div className="lesson-topbar">
                <button className="back-btn" onClick={() => setScreen("dashboard")}>← Voltar</button>
                <div className="lesson-progress">
                  <div className="lesson-progress-fill" style={{ width: `${lessonProgress()}%` }} />
                </div>
                <div className="xp-badge">⚡ {phase.xp} XP</div>
              </div>

              {/* MISSION */}
              {lessonStep === 0 && (
                <div className="step-card">
                  <div className="step-tag">🎯 Missão do Dia</div>
                  <div className="step-question">{phase.title}</div>
                  <div className="road-deco" style={{ margin: "0 0 20px" }}>Objetivo: {phase.subtitle}</div>
                  <div className="step-timeline">
                    {STEPS.map((s, i) => (
                      <div key={s.key} className="timeline-item">
                        <div className="timeline-line-col">
                          <div className={`timeline-dot ${i < lessonStep ? "done" : i === lessonStep ? "current-dot" : "pending"}`}>
                            {i < lessonStep ? "✓" : s.icon}
                          </div>
                          {i < STEPS.length - 1 && <div className="timeline-connector" />}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-step-name">{s.label}</div>
                          <div className="timeline-step-sub">
                            {s.key === 0 && "Entenda o que vamos praticar"}
                            {s.key === 1 && `${phase.quizzes.length} perguntas rápidas`}
                            {s.key === 2 && "Visualize o movimento mental"}
                            {s.key === 3 && "Execute no carro real"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "hsl(var(--blue-50))", borderRadius: 14, padding: 16, marginBottom: 8, fontSize: "0.9rem", lineHeight: 1.6, color: "hsl(224 76% 48%)", fontWeight: 600 }}>
                    {currentPhase === 0 && "Nesta fase, o carro deixa de ser uma ameaça e se torna um objeto familiar. Você vai explorar cada pedal, entender suas funções e criar o primeiro contato seguro. 🚗"}
                    {currentPhase === 1 && "Aqui está o gargalo da maioria dos alunos: a coordenação motora. Vamos automatizar os pés ANTES de cobrar direção perfeita. ⚙️"}
                    {currentPhase === 2 && "Com os pés automatizados, chegou a hora do volante. Você vai aprender a manter o carro reto e fazer curvas suaves com confiança. 🏁"}
                  </div>
                  <button className="btn-primary" onClick={() => setLessonStep(1)}>Começar Missão ▶</button>
                </div>
              )}

              {/* QUIZ */}
              {lessonStep === 1 && (
                <div className="step-card">
                  {isRetry ? (
                    <div className="step-tag" style={{ background: "hsl(48 96% 89%)", color: "hsl(26 90% 37%)", borderRadius: 20 }}>
                      🔄 Revisão — {retryQueue.length} {retryQueue.length === 1 ? "pergunta" : "perguntas"} restante{retryQueue.length !== 1 ? "s" : ""}
                    </div>
                  ) : (
                    <div className="step-tag">❓ Quiz Rápido — {quizIndex + 1} de {quizTotal}</div>
                  )}

                  {phase.quizzes[quizIndex].gif && (
                    <GifIllustration
                      key={`${currentPhase}-${quizIndex}-${isRetry ? "r" : "n"}-${answered ? "a" : "q"}`}
                      gifId={phase.quizzes[quizIndex].gif}
                      alt={phase.quizzes[quizIndex].gifAlt}
                      emoji={phase.quizzes[quizIndex].emoji || "🚗"}
                    />
                  )}

                  <div className="step-question">{phase.quizzes[quizIndex].q}</div>

                  <div className="quiz-options">
                    {phase.quizzes[quizIndex].opts.map((opt, i) => (
                      <button
                        key={i}
                        className={`quiz-option ${answered && i === phase.quizzes[quizIndex].correct ? "correct" : ""} ${answered && selected === i && i !== phase.quizzes[quizIndex].correct ? "wrong" : ""} ${!answered && selected === i ? "selected" : ""}`}
                        onClick={() => handleQuizSelect(i)}
                      >
                        <div className="option-letter">{["A", "B", "C", "D"][i]}</div>
                        {opt}
                      </button>
                    ))}
                  </div>

                  {answered && (
                    <div className={`feedback-banner ${selected === phase.quizzes[quizIndex].correct ? "correct-fb" : "wrong-fb"}`}>
                      <span style={{ fontSize: "1.2rem" }}>
                        {selected === phase.quizzes[quizIndex].correct ? "🎉" : "💡"}
                      </span>
                      <div>
                        <div>{phase.quizzes[quizIndex].explain}</div>
                        {selected !== phase.quizzes[quizIndex].correct && (
                          <div style={{ marginTop: 6, fontWeight: 800, fontSize: "0.82rem", opacity: 0.9 }}>
                            🔄 Essa pergunta voltará para você responder corretamente!
                          </div>
                        )}
                        {selected === phase.quizzes[quizIndex].correct && isRetry && (
                          <div style={{ marginTop: 6, fontWeight: 800, fontSize: "0.82rem", opacity: 0.9 }}>
                            ✅ Agora você sabe! Pergunta superada.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {answered && (
                    <button className="btn-primary" onClick={nextQuiz}>
                      {isRetry
                        ? (selected === phase.quizzes[quizIndex].correct
                            ? (retryQueue.filter(idx => idx !== quizIndex).length > 0
                                ? "Próxima Revisão →"
                                : "Concluir Revisão ✓")
                            : "Tentar Novamente 🔄")
                        : (quizIndex < quizTotal - 1
                            ? "Próxima Pergunta →"
                            : "Ir para Simulação →")}
                    </button>
                  )}
                </div>
              )}

              {/* SIMULATION */}
              {lessonStep === 2 && (
                <div className="step-card">
                  <div className="step-tag">🧠 Simulação Mental Guiada</div>
                  <div className="step-question">Visualize o movimento antes de executar</div>
                  <div className="simulation-area">
                    <div className="simulation-title">
                      {currentPhase === 0 && "🚗 Explorando os Pedais"}
                      {currentPhase === 1 && "⚙️ Sequência da Segunda Marcha"}
                      {currentPhase === 2 && "🏁 Controle do Volante"}
                    </div>
                    <div className="simulation-desc">
                      {currentPhase === 0 && "Toque em cada pedal abaixo. Diga em voz alta a função dele. Repita até o movimento ficar natural."}
                      {currentPhase === 1 && "Siga a sequência em câmera lenta: embreagem → marcha → aceleração suave → soltar embreagem."}
                      {currentPhase === 2 && "Visualize: carro reto na faixa, mãos leves, olhar longe — não para o capô."}
                    </div>

                    {currentPhase === 0 && (
                      <div className="pedals-row">
                        {[{ icon: "🦵", name: "Embreagem", key: "e" }, { icon: "🛑", name: "Freio", key: "f" }, { icon: "▶️", name: "Acelerador", key: "a" }].map(p => (
                          <div
                            key={p.key}
                            className={`pedal ${pressedPedal === p.key ? "pressed" : ""}`}
                            onMouseDown={() => setPressedPedal(p.key)}
                            onMouseUp={() => setPressedPedal(null)}
                            onTouchStart={() => setPressedPedal(p.key)}
                            onTouchEnd={() => setPressedPedal(null)}
                          >
                            <div className="pedal-icon">{p.icon}</div>
                            <div className="pedal-name">{p.name}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {currentPhase === 1 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {["1️⃣ Pé esquerdo na embreagem", "2️⃣ Mão na alavanca de câmbio", "3️⃣ Pé direito com aceleração suave", "4️⃣ Soltar embreagem devagar"].map((step, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: "0.9rem", fontWeight: 600 }}>{step}</div>
                        ))}
                      </div>
                    )}

                    {currentPhase === 2 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {["👀 Olhos para longe — não para o capô", "🤲 Mãos leves — não aperte o volante", "📍 Mantenha o carro na faixa", "🛣️ Reduzir antes do quebra-mola"].map((step, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: "0.9rem", fontWeight: 600 }}>{step}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ background: "hsl(120 100% 97%)", borderRadius: 14, padding: 16, fontSize: "0.9rem", color: "hsl(164 86% 16%)", fontWeight: 600, lineHeight: 1.6 }}>
                    💡 <strong>Por que visualizar?</strong> O cérebro não distingue muito bem entre simulação mental e ação real. Ao visualizar, você já está treinando o mapa motor!
                  </div>

                  <button className="btn-primary" onClick={() => setLessonStep(3)}>Ir para Prática Real →</button>
                </div>
              )}

              {/* PRACTICE */}
              {lessonStep === 3 && (() => {
                const tasks = CHECKLIST_TASKS[currentPhase];
                const checkedCount = tasks.filter(t => checkedTasks[t.id]).length;
                const allDone = checkedCount === tasks.length;
                return (
                  <div className="step-card">
                    <div className="step-tag">🚗 Prática Real</div>
                    <div className="step-question">
                      {currentPhase === 0 && "Com o carro ligado e parado — sem sair do lugar"}
                      {currentPhase === 1 && "Em local aberto — andar poucos metros"}
                      {currentPhase === 2 && "Manter faixa e fazer curvas suaves"}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "hsl(var(--blue-700))" }}>Progresso da prática</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: allDone ? "hsl(var(--green))" : "hsl(var(--blue-500))" }}>
                          {checkedCount}/{tasks.length} {allDone && "✓"}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(checkedCount / tasks.length) * 100}%`,
                            background: allDone
                              ? "linear-gradient(90deg, hsl(var(--green)), hsl(160 72% 67%))"
                              : "linear-gradient(90deg, hsl(var(--blue-500)), hsl(var(--blue-300)))"
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                      {tasks.map((task) => {
                        const isChecked = !!checkedTasks[task.id];
                        return (
                          <button
                            key={task.id}
                            onClick={() => toggleTask(task.id)}
                            className={`checklist-item ${isChecked ? "checklist-done" : ""}`}
                          >
                            <div className={`checklist-box ${isChecked ? "checklist-box-done" : ""}`}>
                              {isChecked && (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className="checklist-icon">{task.icon}</span>
                            <span className={`checklist-text ${isChecked ? "checklist-text-done" : ""}`}>{task.text}</span>
                            {isChecked && <span className="checklist-xp">+5 XP</span>}
                          </button>
                        );
                      })}
                    </div>

                    {allDone && (
                      <div className="checklist-complete-banner">
                        <span style={{ fontSize: "1.5rem" }}>🎉</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "1rem" }}>Prática concluída!</div>
                          <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>Você completou todas as tarefas.</div>
                        </div>
                      </div>
                    )}

                    <div style={{ borderRadius: 14, padding: 16, background: "linear-gradient(135deg, hsl(var(--blue-50)), hsl(var(--blue-100)))", fontSize: "0.9rem", fontWeight: 600, color: "hsl(224 76% 48%)", lineHeight: 1.6, marginBottom: 8 }}>
                      🎓 <strong>Critério para avançar:</strong>{" "}
                      {currentPhase === 0 && "Identificar e usar os pedais sem olhar para baixo."}
                      {currentPhase === 1 && "Trocar para segunda marcha sem tranco perceptível."}
                      {currentPhase === 2 && "Manter o carro alinhado na faixa com curvas suaves."}
                    </div>

                    <button className="btn-primary" onClick={completePhase} style={!allDone ? { opacity: 0.5 } : {}} disabled={!allDone}>
                      🎉 Concluir Fase!
                    </button>
                    <button className="btn-secondary" onClick={() => setLessonStep(2)}>← Rever Simulação</button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* CONQUEST */}
          {screen === "conquest" && (
            <ConquestScreen
              phase={phase}
              completedPhases={completedPhases}
              onDashboard={() => setScreen("dashboard")}
              onNextLesson={() => startLesson(completedPhases.length)}
              totalPhases={PHASES.length}
              onEmotionSubmit={submitEmotion}
              phaseIndex={currentPhase}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DrivingApp;
