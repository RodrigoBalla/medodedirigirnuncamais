import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
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
import { AppLayout, type AppTab } from "@/components/AppLayout";
import { LessonScreen } from "@/components/LessonScreen";
import { RankingScreen } from "@/components/RankingScreen";
import { CommunityScreen } from "@/components/CommunityScreen";
import { ProfileScreen } from "@/components/ProfileScreen";

type Screen = "welcome" | "welcome-back" | "app";
type LessonScreen = "none" | "lesson" | "conquest";

const DrivingApp = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [screen, setScreen] = useState<Screen>("app");
  const [lessonScreen, setLessonScreen] = useState<LessonScreen>("none");
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const path = window.location.pathname;
    if (path.startsWith("/treinos")) return "treinos";
    if (path.startsWith("/ranking")) return "ranking";
    if (path.startsWith("/comunidade")) return "comunidade";
    if (path.startsWith("/perfil")) return "perfil";
    return "home";
  });
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

  // Sync URL → state on mount/navigation
  useEffect(() => {
    const path = location.pathname;
    const aulaMatch = path.match(/^\/aula\/(\d+)$/);
    if (path === "/boas-vindas") {
      setScreen("welcome");
    } else if (path === "/bem-vindo") {
      setScreen("welcome-back");
    } else if (aulaMatch) {
      setScreen("app");
      const idx = parseInt(aulaMatch[1], 10) - 1;
      if (idx >= 0 && idx < PHASES.length) {
        setCurrentPhase(idx);
        setLessonScreen("lesson");
        setLessonStep(0);
        setQuizIndex(0);
        setSelected(null);
        setAnswered(false);
        setCheckedTasks({});
        setRetryQueue([]);
        setIsRetry(false);
      }
    } else if (path === "/treinos") {
      setScreen("app");
      setActiveTab("treinos");
      setLessonScreen("none");
    } else if (path === "/ranking") {
      setScreen("app");
      setActiveTab("ranking");
    } else if (path === "/comunidade") {
      setScreen("app");
      setActiveTab("comunidade");
    } else if (path === "/perfil") {
      setScreen("app");
      setActiveTab("perfil");
    } else if (path === "/") {
      setScreen("app");
      setActiveTab("home");
      setLessonScreen("none");
    }
  }, [location.pathname]);

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
        if (views === 0 && location.pathname === "/") {
          navigate("/boas-vindas", { replace: true });
        } else if (views > 0 && location.pathname === "/") {
          navigate("/bem-vindo", { replace: true });
        }
      } else {
        setWelcomeVideoViews(0);
        if (location.pathname === "/") {
          navigate("/boas-vindas", { replace: true });
        }
      }
    };
    loadProgress();
  }, [user]);

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
    navigate(`/aula/${idx + 1}`);
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
    setLessonScreen("conquest");
  }

  function submitEmotion(_tensionVal: number, confVal: number) {
    setConfidence(confVal || 4);
  }

  async function handleWelcomeComplete() {
    const newViews = (welcomeVideoViews ?? 0) + 1;
    setWelcomeVideoViews(newViews);
    navigate("/", { replace: true });
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

  // Loading
  if (welcomeVideoViews === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-primary font-bold text-lg">
          <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
          Carregando...
        </div>
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
    const progressPercent = Math.round((completedPhases.length / PHASES.length) * 100);
    return (
      <WelcomeBackScreen
        displayName={displayName}
        onWatchVideo={() => navigate("/boas-vindas", { replace: true })}
        onContinue={() => navigate("/", { replace: true })}
        progressPercent={progressPercent}
      />
    );
  }

  // Tab change handler
  const TAB_ROUTES: Record<AppTab, string> = {
    home: "/",
    treinos: "/treinos",
    ranking: "/ranking",
    comunidade: "/comunidade",
    perfil: "/perfil",
  };

  const handleTabChange = (tab: AppTab) => {
    navigate(TAB_ROUTES[tab]);
  };

  // Render tab content
  const renderContent = () => {
    // If in lesson or conquest, show that regardless of tab
    if (lessonScreen === "lesson" && phase) {
      return (
        <LessonScreen
          phase={phase}
          currentPhase={currentPhase}
          lessonStep={lessonStep}
          setLessonStep={setLessonStep}
          quizIndex={quizIndex}
          quizTotal={quizTotal}
          selected={selected}
          answered={answered}
          isRetry={isRetry}
          retryQueue={retryQueue}
          onQuizSelect={handleQuizSelect}
          onNextQuiz={nextQuiz}
          onBack={() => navigate("/")}
          lessonProgress={lessonProgress()}
          pressedPedal={pressedPedal}
          setPressedPedal={setPressedPedal}
          checkedTasks={checkedTasks}
          toggleTask={toggleTask}
          onCompletePhase={completePhase}
        />
      );
    if (lessonScreen === "conquest") {
      return (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <ConquestScreen
            phase={phase}
            completedPhases={completedPhases}
            onDashboard={() => navigate("/")}
            onNextLesson={() => startLesson(completedPhases.length)}
            totalPhases={PHASES.length}
            onEmotionSubmit={submitEmotion}
            phaseIndex={currentPhase}
          />
        </div>
      );
    }

    switch (activeTab) {
      case "home":
        return renderDashboard();
      case "treinos":
        return renderTreinos();
      case "ranking":
        return <RankingScreen displayName={displayName} totalXP={totalXP} />;
      case "comunidade":
        return <CommunityScreen />;
      case "perfil":
        return <ProfileScreen displayName={displayName} totalXP={totalXP} confidence={confidence} completedPhases={completedPhases.length} totalPhases={PHASES.length} />;
      default:
        return renderDashboard();
    }
  };

  function renderDashboard() {
    const nextPhaseIdx = completedPhases.length;
    const DAILY_MISSIONS = [
      { text: "Acerte 10 placas", progress: "4/10", done: false, icon: "calendar_today" },
      { text: "Leia 1 artigo técnico", progress: "", done: true, icon: "check_circle" },
    ];

    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Module Header */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Módulo 1</p>
          <h1 className="text-2xl font-bold tracking-tight">Primeiros Quilômetros</h1>
          <p className="text-muted-foreground text-sm mt-1">Domine os fundamentos do trânsito</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Learning Path */}
          <div className="flex-1">
            <div className="flex flex-col items-center gap-0 max-w-xs mx-auto">
              {PHASES.map((p, i) => {
                const done = completedPhases.includes(i);
                const isCurrent = i === nextPhaseIdx;
                const locked = i > nextPhaseIdx;
                const isEven = i % 2 === 0;

                return (
                  <div key={p.id} className="relative flex flex-col items-center w-full">
                    {i > 0 && (
                      <div className={`w-0.5 h-8 ${completedPhases.includes(i - 1) ? "bg-primary" : "bg-border"}`} />
                    )}
                    <div className={`flex items-center gap-4 w-full ${isEven ? "flex-row" : "flex-row-reverse"}`}>
                      <button
                        onClick={() => !locked && startLesson(i)}
                        disabled={locked}
                        className={`relative z-10 size-[72px] rounded-full flex items-center justify-center border-4 transition-all shrink-0 ${
                          locked
                            ? "bg-muted border-border opacity-50 cursor-not-allowed"
                            : done
                            ? "bg-primary border-primary/30 shadow-lg shadow-primary/20"
                            : "bg-primary border-primary/30 shadow-lg shadow-primary/20 hover:scale-105"
                        }`}
                      >
                        {locked ? (
                          <span className="material-symbols-outlined text-2xl text-muted-foreground">lock</span>
                        ) : done ? (
                          <span className="material-symbols-outlined text-2xl text-primary-foreground filled-icon">check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-primary-foreground filled-icon">directions_car</span>
                        )}
                      </button>
                      <div className="flex-1">
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full mb-1.5 shadow-md shadow-primary/20">
                            <span className="material-symbols-outlined text-xs">play_arrow</span>
                            COMEÇAR
                          </span>
                        )}
                        <p className={`text-sm font-bold ${locked ? "text-muted-foreground" : "text-foreground"}`}>
                          {p.title.replace(/Fase \d+ — /, "")}
                        </p>
                        {!locked && (
                          <p className="text-xs text-muted-foreground mt-0.5">{p.subtitle}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {FUTURE_PHASES.map((f, i) => (
                <div key={`future-${i}`} className="relative flex flex-col items-center w-full">
                  <div className="w-0.5 h-8 bg-border" />
                  <div className={`flex items-center gap-4 w-full ${(PHASES.length + i) % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                    <div className="size-[72px] rounded-full bg-muted border-4 border-border opacity-40 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl text-muted-foreground">lock</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-muted-foreground opacity-50">{f.title}</p>
                      <p className="text-xs text-muted-foreground opacity-40">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-col items-center mt-2">
                <div className="w-0.5 h-8 bg-border" />
                <div className="size-[72px] rounded-full bg-muted border-4 border-border opacity-30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-muted-foreground">flag_circle</span>
                </div>
                <p className="text-xs font-bold text-muted-foreground opacity-40 mt-2">Fim do Módulo</p>
              </div>
            </div>
          </div>

          {/* RIGHT: Sidebar content */}
          <div className="lg:w-72 flex flex-col gap-4">
            <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">target</span>
                Missões Diárias
              </h3>
              <div className="flex flex-col gap-2.5">
                {DAILY_MISSIONS.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-lg ${m.done ? "text-primary filled-icon" : "text-muted-foreground"}`}>
                      {m.done ? "check_circle" : m.icon}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${m.done ? "line-through text-muted-foreground" : ""}`}>{m.text}</p>
                      {m.progress && <p className="text-xs text-muted-foreground">{m.progress}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
              <h3 className="text-sm font-bold mb-3">Conquistas</h3>
              <div className="grid grid-cols-3 gap-2">
                {ACHIEVEMENTS.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-2.5 flex flex-col items-center text-center border transition-all ${
                      a.unlocked ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-border opacity-30"
                    }`}
                  >
                    <div className="text-xl mb-1">{a.icon}</div>
                    <p className="text-[10px] font-bold leading-tight">{a.name}</p>
                  </div>
                ))}
              </div>
              <button className="w-full mt-3 text-xs text-primary font-bold hover:underline">Ver Todas</button>
            </div>

            <div className="bg-accent rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
                <span className="font-bold text-sm text-foreground">Dica do Dia</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A distância de segurança deve ser de aproximadamente dois segundos em relação ao veículo à frente.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTreinos() {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Trilha de Aprendizado</h1>
        <p className="text-muted-foreground text-sm mb-6">Domine os fundamentos do trânsito</p>

        {/* Gamified path */}
        <div className="flex flex-col items-center gap-6 max-w-xs mx-auto mb-8">
          {PHASES.map((p, i) => {
            const done = completedPhases.includes(i);
            const isCurrent = i === completedPhases.length;
            const locked = i > completedPhases.length;
            const offset = i % 2 === 0 ? "" : "ml-20";

            return (
              <div key={p.id} className={`relative flex flex-col items-center ${offset}`}>
                <button
                  onClick={() => !locked && startLesson(i)}
                  disabled={locked}
                  className={`relative z-10 size-20 rounded-full flex items-center justify-center border-4 transition-all ${
                    locked
                      ? "bg-muted border-border/50 opacity-60 cursor-not-allowed"
                      : done
                      ? "bg-primary border-primary-foreground/20 shadow-[0_6px_0_0_hsl(var(--blue-800))] hover:translate-y-0.5 hover:shadow-[0_3px_0_0_hsl(var(--blue-800))]"
                      : "bg-primary border-primary-foreground/20 shadow-[0_6px_0_0_hsl(var(--blue-800))] hover:translate-y-0.5 hover:shadow-[0_3px_0_0_hsl(var(--blue-800))]"
                  }`}
                >
                  {locked ? (
                    <span className="material-symbols-outlined text-3xl text-muted-foreground">lock</span>
                  ) : done ? (
                    <span className="material-symbols-outlined text-3xl text-primary-foreground filled-icon">check_circle</span>
                  ) : (
                    <span className="text-3xl">{p.icon}</span>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-10 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg animate-bounce shadow-lg">
                      COMEÇAR
                    </div>
                  )}
                </button>
                <div className="mt-3 bg-card px-3 py-1.5 rounded-xl shadow-sm border border-border">
                  <span className={`text-sm font-bold ${locked ? "text-muted-foreground" : ""}`}>{p.title.replace(/Fase \d+ — /, "")}</span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`absolute top-20 h-10 w-0.5 ${done ? "bg-primary" : "bg-border"}`} style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 4px, ${done ? "hsl(var(--primary))" : "hsl(var(--border))"} 4px, ${done ? "hsl(var(--primary))" : "hsl(var(--border))"} 8px)` }} />
                )}
              </div>
            );
          })}

          {/* Future phases */}
          {FUTURE_PHASES.map((f, i) => (
            <div key={i} className="relative flex flex-col items-center opacity-40">
              <div className="size-20 rounded-full bg-muted border-4 border-border/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-muted-foreground">lock</span>
              </div>
              <div className="mt-3 bg-card px-3 py-1.5 rounded-xl shadow-sm border border-border">
                <span className="text-sm font-bold text-muted-foreground">{f.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderLesson() {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Lesson topbar */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            className="bg-muted rounded-xl px-3 py-2 font-bold text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            ← Voltar
          </button>
          <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all"
              style={{ width: `${lessonProgress()}%` }}
            />
          </div>
          <div className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1">
            ⚡ {phase.xp} XP
          </div>
        </div>

        {/* Step content */}
        <div className="bg-card rounded-2xl p-5 md:p-8 border border-border shadow-sm">
          {/* MISSION */}
          {lessonStep === 0 && (
            <div>
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                🎯 Missão do Dia
              </span>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">{phase.title}</h2>
              <p className="text-muted-foreground text-sm mb-4">Objetivo: {phase.subtitle}</p>

              {/* Timeline */}
              <div className="flex flex-col gap-0 mb-4">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        i < lessonStep ? "bg-green-500 text-white" : i === lessonStep ? "bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--blue-200))]" : "bg-muted text-muted-foreground"
                      }`}>
                        {i < lessonStep ? "✓" : s.icon}
                      </div>
                      {i < STEPS.length - 1 && <div className="w-0.5 min-h-[20px] bg-border my-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="font-bold text-sm">{s.label}</p>
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

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-sm text-primary font-medium leading-relaxed mb-4">
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
              {isRetry ? (
                <span className="inline-flex items-center gap-1.5 bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-bold uppercase mb-4">
                  🔄 Revisão — {retryQueue.length} restante{retryQueue.length !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                  Pergunta {String(quizIndex + 1).padStart(2, "0")}
                </span>
              )}

              {phase.quizzes[quizIndex].gif && (
                <GifIllustration
                  key={`${currentPhase}-${quizIndex}-${isRetry ? "r" : "n"}-${answered ? "a" : "q"}`}
                  gifId={phase.quizzes[quizIndex].gif}
                  alt={phase.quizzes[quizIndex].gifAlt}
                  emoji={phase.quizzes[quizIndex].emoji || "🚗"}
                />
              )}

              <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-5">{phase.quizzes[quizIndex].q}</h2>

              <div className="flex flex-col gap-3">
                {phase.quizzes[quizIndex].opts.map((opt, i) => {
                  const isCorrect = answered && i === phase.quizzes[quizIndex].correct;
                  const isWrong = answered && selected === i && i !== phase.quizzes[quizIndex].correct;
                  const isSelected = !answered && selected === i;

                  return (
                    <button
                      key={i}
                      onClick={() => handleQuizSelect(i)}
                      className={`group flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : isWrong
                          ? "border-destructive bg-destructive/5"
                          : isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <div className={`size-9 shrink-0 flex items-center justify-center rounded-lg font-bold text-sm ${
                        isCorrect
                          ? "bg-green-500 text-white"
                          : isWrong
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-card border border-border text-muted-foreground group-hover:text-primary group-hover:border-primary/30"
                      }`}>
                        {["A", "B", "C", "D"][i]}
                      </div>
                      <p className={`font-medium text-sm ${isCorrect ? "text-green-800 dark:text-green-200 font-bold" : isWrong ? "text-destructive" : ""}`}>
                        {opt}
                      </p>
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 text-sm font-medium leading-relaxed ${
                  selected === phase.quizzes[quizIndex].correct
                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200"
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

              {answered && (
                <button onClick={nextQuiz} className="w-full mt-4 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  {isRetry
                    ? (selected === phase.quizzes[quizIndex].correct
                        ? (retryQueue.filter(idx => idx !== quizIndex).length > 0 ? "Próxima Revisão →" : "Concluir Revisão ✓")
                        : "Tentar Novamente 🔄")
                    : (quizIndex < quizTotal - 1 ? "Próxima Pergunta →" : "Ir para Simulação →")}
                </button>
              )}
            </div>
          )}

          {/* SIMULATION */}
          {lessonStep === 2 && (
            <div>
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                🧠 Simulação Mental
              </span>
              <h2 className="text-xl font-bold tracking-tight mb-4">Visualize o movimento</h2>

              <div className="bg-gradient-to-br from-[hsl(var(--blue-800))] to-[hsl(var(--blue-900))] rounded-xl p-5 text-white mb-4">
                <h3 className="text-lg font-bold mb-2">
                  {currentPhase === 0 && "🚗 Explorando os Pedais"}
                  {currentPhase === 1 && "⚙️ Sequência da Segunda Marcha"}
                  {currentPhase === 2 && "🏁 Controle do Volante"}
                </h3>
                <p className="text-sm opacity-80 mb-4">
                  {currentPhase === 0 && "Toque em cada pedal. Diga a função em voz alta."}
                  {currentPhase === 1 && "Embreagem → marcha → aceleração → soltar embreagem."}
                  {currentPhase === 2 && "Carro reto, mãos leves, olhar longe."}
                </p>

                {currentPhase === 0 && (
                  <div className="flex gap-3 justify-center">
                    {[{ icon: "🦵", name: "Embreagem", key: "e" }, { icon: "🛑", name: "Freio", key: "f" }, { icon: "▶️", name: "Acelerador", key: "a" }].map(p => (
                      <button
                        key={p.key}
                        className={`bg-white/10 border border-white/20 rounded-xl p-3 text-center min-w-[70px] transition-all ${pressedPedal === p.key ? "bg-primary/50 scale-95" : "hover:bg-white/20"}`}
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
                      <div key={i} className="bg-white/10 rounded-lg p-2.5 text-sm font-medium">{step}</div>
                    ))}
                  </div>
                )}

                {currentPhase === 2 && (
                  <div className="flex flex-col gap-2">
                    {["👀 Olhos para longe", "🤲 Mãos leves", "📍 Manter na faixa", "🛣️ Reduzir no quebra-mola"].map((step, i) => (
                      <div key={i} className="bg-white/10 rounded-lg p-2.5 text-sm font-medium">{step}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-sm text-green-800 dark:text-green-200 font-medium leading-relaxed border border-green-200 dark:border-green-800 mb-4">
                💡 <strong>Por que visualizar?</strong> O cérebro não distingue entre simulação mental e ação real!
              </div>

              <button onClick={() => setLessonStep(3)} className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                Ir para Prática Real →
              </button>
            </div>
          )}

          {/* PRACTICE */}
          {lessonStep === 3 && (() => {
            const tasks = CHECKLIST_TASKS[currentPhase];
            const checkedCount = tasks.filter(t => checkedTasks[t.id]).length;
            const allDone = checkedCount === tasks.length;
            return (
              <div>
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                  🚗 Prática Real
                </span>
                <h2 className="text-xl font-bold tracking-tight mb-4">
                  {currentPhase === 0 && "Com o carro ligado e parado"}
                  {currentPhase === 1 && "Em local aberto — andar poucos metros"}
                  {currentPhase === 2 && "Manter faixa e fazer curvas suaves"}
                </h2>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className={allDone ? "text-green-600" : "text-primary"}>{checkedCount}/{tasks.length}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${(checkedCount / tasks.length) * 100}%`,
                      background: allDone ? "hsl(160 84% 39%)" : "hsl(var(--primary))"
                    }} />
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 mb-4">
                  {tasks.map((task) => {
                    const isChecked = !!checkedTasks[task.id];
                    return (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
                          isChecked ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className={`size-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isChecked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"
                        }`}>
                          {isChecked && (
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                              <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-lg">{task.icon}</span>
                        <span className={`flex-1 text-sm font-medium ${isChecked ? "line-through opacity-60" : ""}`}>{task.text}</span>
                        {isChecked && <span className="text-xs font-bold text-green-600 bg-green-100 rounded px-1.5 py-0.5">+5 XP</span>}
                      </button>
                    );
                  })}
                </div>

                {allDone && (
                  <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-4 mb-4">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <p className="font-bold text-sm">Prática concluída!</p>
                      <p className="text-xs text-muted-foreground">Todas as tarefas completadas.</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={completePhase}
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
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      displayName={displayName}
      totalXP={totalXP}
      confidence={confidence}
      completedPhases={completedPhases.length}
    >
      {renderContent()}
    </AppLayout>
  );
};

export default DrivingApp;
