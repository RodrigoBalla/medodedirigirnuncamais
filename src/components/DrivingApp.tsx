import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [unlockedPhase, setUnlockedPhase] = useState<number | null>(null);

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

  // Detect unlock animation trigger from completion screen
  useEffect(() => {
    const unlocked = searchParams.get("unlocked");
    if (unlocked !== null) {
      const idx = parseInt(unlocked, 10);
      // Mark the phase as completed if not already
      setCompletedPhases(prev => {
        if (!prev.includes(idx)) {
          const updated = [...prev, idx];
          // Persist to database
          if (user) {
            supabase
              .from("user_progress")
              .update({ completed_phases: updated, updated_at: new Date().toISOString() })
              .eq("user_id", user.id)
              .then(() => {});
          }
          return updated;
        }
        return prev;
      });
      // Small delay so the dashboard renders first, then animate
      setTimeout(() => setUnlockedPhase(idx), 400);
      // Clean up the URL param
      searchParams.delete("unlocked");
      setSearchParams(searchParams, { replace: true });
      // Clear animation after it plays
      setTimeout(() => setUnlockedPhase(null), 3500);
    }
  }, [searchParams]);

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
                const justCompleted = unlockedPhase === i;
                const justUnlocked = unlockedPhase !== null && i === unlockedPhase + 1 && !done;

                return (
                  <div key={p.id} className="relative flex flex-col items-center w-full">
                    {i > 0 && (
                      <motion.div
                        className="w-0.5 h-8"
                        initial={justCompleted || justUnlocked ? { backgroundColor: "hsl(var(--border))" } : undefined}
                        animate={{
                          backgroundColor: completedPhases.includes(i - 1)
                            ? "hsl(var(--primary))"
                            : "hsl(var(--border))"
                        }}
                        transition={justCompleted ? { delay: 0.3, duration: 0.6 } : { duration: 0 }}
                      />
                    )}
                    <div className={`flex items-center gap-4 w-full ${isEven ? "flex-row" : "flex-row-reverse"}`}>
                      <motion.button
                        onClick={() => !locked && startLesson(i)}
                        disabled={locked && !justUnlocked}
                        initial={
                          justCompleted
                            ? { scale: 1 }
                            : justUnlocked
                            ? { scale: 0.8, opacity: 0.5 }
                            : undefined
                        }
                        animate={
                          justCompleted
                            ? {
                                scale: [1, 1.25, 1],
                                boxShadow: [
                                  "0 0 0 0 hsl(var(--primary) / 0)",
                                  "0 0 0 16px hsl(var(--primary) / 0.3)",
                                  "0 0 0 0 hsl(var(--primary) / 0)",
                                ],
                              }
                            : justUnlocked
                            ? { scale: [0.8, 1.15, 1], opacity: [0.5, 1, 1] }
                            : undefined
                        }
                        transition={
                          justCompleted
                            ? { duration: 1.2, delay: 0.2, ease: "easeOut" }
                            : justUnlocked
                            ? { duration: 0.8, delay: 1.2, ease: "easeOut" }
                            : undefined
                        }
                        className={`relative z-10 size-[72px] rounded-full flex items-center justify-center border-4 transition-colors shrink-0 ${
                          locked && !justUnlocked
                            ? "bg-muted border-border opacity-50 cursor-not-allowed"
                            : done || justCompleted
                            ? "bg-primary border-primary/30 shadow-lg shadow-primary/20"
                            : "bg-primary border-primary/30 shadow-lg shadow-primary/20 hover:scale-105"
                        }`}
                      >
                        {locked && !justUnlocked ? (
                          <span className="material-symbols-outlined text-2xl text-muted-foreground">lock</span>
                        ) : done || justCompleted ? (
                          <motion.span
                            className="material-symbols-outlined text-2xl text-primary-foreground filled-icon"
                            initial={justCompleted ? { rotate: 0, scale: 0 } : undefined}
                            animate={justCompleted ? { rotate: [0, 360], scale: [0, 1.3, 1] } : undefined}
                            transition={justCompleted ? { duration: 0.8, delay: 0.5 } : undefined}
                          >
                            check_circle
                          </motion.span>
                        ) : justUnlocked ? (
                          <motion.span
                            className="material-symbols-outlined text-2xl text-primary-foreground filled-icon"
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.6, delay: 1.5 }}
                          >
                            directions_car
                          </motion.span>
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-primary-foreground filled-icon">directions_car</span>
                        )}
                      </motion.button>
                      <div className="flex-1">
                        {(isCurrent || justUnlocked) && (
                          <motion.span
                            initial={justUnlocked ? { opacity: 0, scale: 0.5, y: -10 } : undefined}
                            animate={justUnlocked ? { opacity: 1, scale: 1, y: 0 } : undefined}
                            transition={justUnlocked ? { delay: 1.8, duration: 0.5, type: "spring" } : undefined}
                            className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full mb-1.5 shadow-md shadow-primary/20"
                          >
                            <span className="material-symbols-outlined text-xs">play_arrow</span>
                            {justUnlocked ? "DESBLOQUEADA!" : "COMEÇAR"}
                          </motion.span>
                        )}
                        <p className={`text-sm font-bold ${locked && !justUnlocked ? "text-muted-foreground" : "text-foreground"}`}>
                          {p.title.replace(/Fase \d+ — /, "")}
                        </p>
                        {(!locked || justUnlocked) && (
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

  // renderLesson removed — now using LessonScreen component

  // If in lesson mode, render LessonScreen full-page (outside AppLayout)
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
