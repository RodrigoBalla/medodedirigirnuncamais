import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PHASES, FUTURE_PHASES, ACHIEVEMENTS, CHECKLIST_TASKS } from "@/data/driving-data";
import { ConquestScreen } from "@/components/ConquestScreen";
import {
  playCorrectSound,
  playWrongSound,
  playCheckSound,
  playAllDoneSound,
  playConquestSound,
  playHornSound,
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
import { LibraryScreen } from "@/components/lms/LibraryScreen";
import { CoursePlayerScreen } from "@/components/lms/CoursePlayerScreen";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { LevelUpOverlay } from "@/components/lms/LevelUpOverlay";
import { DrivingMap } from "@/components/lms/DrivingMap";
import { DailyBonusGrid } from "@/components/lms/DailyBonusGrid";
import { DailyMissions } from "@/components/lms/DailyMissions";
import { OnboardingGuide } from "@/components/lms/OnboardingGuide";

type Screen = "welcome" | "welcome-back" | "app" | "course-player";
type LessonScreenState = "none" | "lesson" | "conquest";

const DrivingApp = () => {
  const { user } = useAuth();
  const { 
    lives, 
    coins, 
    totalXP, 
    completedPhases, 
    confidence, 
    addXP, 
    addCoins,
    updateConfidence, 
    completePhase: markPhaseComplete,
    streak,
    level: globalLevel,
    dailyXP,
    dailyLessons,
    addBadge,
    badges,
    spendCoins
  } = useUserProgress();
  
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [lastLevel, setLastLevel] = useState<number | null>(null);

  // Level Up Detection
  useEffect(() => {
    if (lastLevel === null) {
      setLastLevel(globalLevel);
      return;
    }
    if (globalLevel > lastLevel) {
      setShowLevelUp(true);
      setLastLevel(globalLevel);
      if (globalLevel >= 2) addBadge("primeiros_km");
    }
  }, [globalLevel, lastLevel, addBadge]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [screen, setScreen] = useState<Screen>("app");
  const [lessonScreen, setLessonScreen] = useState<LessonScreenState>("none");
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const path = window.location.pathname;
    if (path.startsWith("/treinos")) return "treinos";
    if (path.startsWith("/ranking")) return "ranking";
    if (path.startsWith("/comunidade")) return "comunidade";
    if (path.startsWith("/biblioteca")) return "biblioteca";
    if (path.startsWith("/perfil")) return "perfil";
    return "home";
  });
  const [welcomeVideoViews, setWelcomeVideoViews] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [lessonStep, setLessonStep] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [pressedPedal, setPressedPedal] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [retryQueue, setRetryQueue] = useState<number[]>([]);
  const [isRetry, setIsRetry] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [unlockedPhase, setUnlockedPhase] = useState<number | null>(null);
  const [mapChallenge, setMapChallenge] = useState<any>(null);
  const [comboCount, setComboCount] = useState(0);
  const [comboText, setComboText] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // MVP: tutorial só dispara quando o aluno entra no módulo de Missões (aba Treinos)
  // pela primeira vez, e nunca antes — em "Meus Cursos" ou outras abas, fica oculto.
  useEffect(() => {
    if (activeTab === "treinos" && lessonScreen === "none") {
      const done = localStorage.getItem("onboarding_completed");
      if (!done) {
        // Small delay so the screen renders first
        const timer = setTimeout(() => setShowOnboarding(true), 800);
        return () => clearTimeout(timer);
      }
    } else {
      // Garante que sai de overlay se trocar de aba
      setShowOnboarding(false);
    }
  }, [activeTab, lessonScreen]);

  // Premium courses from Supabase
  const [premiumCourses, setPremiumCourses] = useState<any[]>([]);
  const [unlockedCourses, setUnlockedCourses] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("unlocked_courses") || "[]"); } catch { return []; }
  });
  const [purchaseModal, setPurchaseModal] = useState<{ id: string; title: string; price: number } | null>(null);

  // Fetch premium courses
  useEffect(() => {
    async function fetchCourses() {
      const { data } = await supabase
        .from("products")
        .select("id, title, description, image_url, status")
        .eq("status", "published")
        .order("created_at", { ascending: true });
      setPremiumCourses(data || []);
    }
    fetchCourses();
  }, []);

  // Sync URL -> state on mount/navigation
  useEffect(() => {
    const path = location.pathname;
    const aulaMatch = path.match(/^\/aula\/(\d+)$/);
    const cursoMatch = path.match(/^\/curso\/([a-zA-Z0-9-]+)$/);

    if (path === "/boas-vindas") {
      setScreen("welcome");
    } else if (path === "/bem-vindo") {
      setScreen("welcome-back");
    } else if (cursoMatch) {
      setScreen("course-player");
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
    } else if (path.startsWith("/biblioteca")) {
      setScreen("app");
      setActiveTab("biblioteca");
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
      if (!completedPhases.includes(idx)) {
        markPhaseComplete(idx);
      }
      setTimeout(() => setUnlockedPhase(idx), 400);
      searchParams.delete("unlocked");
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => setUnlockedPhase(null), 3500);
    }
  }, [searchParams, completedPhases]);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      if (profile) setDisplayName(profile.display_name || user.user_metadata?.display_name || "");

      const { data: progress } = await supabase
        .from("user_progress")
        .select("welcome_video_views")
        .eq("user_id", user.id)
        .single();
      
      if (progress) {
        const views = progress.welcome_video_views ?? 0;
        setWelcomeVideoViews(views);
      } else {
        setWelcomeVideoViews(0);
      }
      // MVP: ao entrar na área de membros, sempre cair em "Meus Cursos".
      // Vídeo de boas-vindas e tela "bem-vindo de volta" continuam acessíveis,
      // mas não são mais redirecionamentos automáticos.
      if (location.pathname === "/") {
        navigate("/biblioteca", { replace: true });
      }
    };
    loadProfile();
  }, [user]);

  const phase = PHASES[currentPhase];
  const quizTotal = phase ? phase.quizzes.length : 0;

  function startLesson(idx: number) {
    if (idx > completedPhases.length) return;
    if (lives <= 0) {
      toast.error("Você está sem vidas! ❤️", { description: "Espere regenerar ou compre na loja." });
      return;
    }
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
      if (!isRetry) addXP(10);
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
        const reQueued = [...retryQueue.filter(idx => idx !== quizIndex), quizIndex];
        setRetryQueue(reQueued);
        setQuizIndex(reQueued[0]);
        setSelected(null);
        setAnswered(false);
      }
    }
  }

  function completePhase() {
    if (!completedPhases.includes(currentPhase)) {
      markPhaseComplete(currentPhase);
      addXP(phase.xp);
      updateConfidence(4);
      playConquestSound();
    }
    setLessonScreen("conquest");
  }

  function handleStartMapTraining(pin: any) {
    // Generate theme-based questions for the location
    const questions = pin.type === "parking" ? [
      { q: "Qual a distância ideal do meio-fio na baliza?", options: ["10-30cm", "50-80cm", "1m"], correct: 0 },
      { q: "Onde você deve olhar primeiro ao dar ré?", options: ["Retrovisor interno", "Janela lateral", "Todos os retrovisores"], correct: 2 }
    ] : pin.type === "hills" ? [
      { q: "Qual o pé que controla a 'altura' da embreagem?", options: ["Direito", "Esquerdo", "Ambos"], correct: 1 },
      { q: "Sentiu o carro tremer na subida, o que fazer?", options: ["Soltar o freio", "Acelerar fundo", "Pisar na embreagem"], correct: 0 }
    ] : [
      { q: "Qual a preferência em um cruzamento sem sinalização?", options: ["Quem vem da direita", "Quem vem mais rápido", "Quem está na via maior"], correct: 0 }
    ];

    setMapChallenge({
      ...pin,
      quizzes: questions.map((q, i) => ({ ...q, id: `map-${pin.id}-${i}` }))
    });
  }

  function handleMapChallengeComplete() {
    addXP(mapChallenge.xp);
    addCoins(15);
    setMapChallenge(null);
    toast.success("Treino Concluído! 🚗💨", {
      description: `Você ganhou +${mapChallenge.xp} XP e +15 moedas!`
    });
  }

  function submitEmotion(_tensionVal: number, confVal: number) {
    updateConfidence(confVal || 4);
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
    return <WelcomeScreen displayName={displayName} videoViews={welcomeVideoViews} onComplete={handleWelcomeComplete} />;
  }

  if (screen === "welcome-back") {
    return (
      <WelcomeBackScreen
        displayName={displayName}
        onWatchVideo={() => navigate("/boas-vindas", { replace: true })}
        onContinue={() => navigate("/", { replace: true })}
        progressPercent={Math.round((completedPhases.length / PHASES.length) * 100)}
      />
    );
  }

  if (screen === "course-player") {
    const cursoId = location.pathname.split("/")[2];
    return <CoursePlayerScreen productId={cursoId} onBack={() => navigate("/biblioteca")} />;
  }

  const handleTabChange = (tab: AppTab) => {
    const TAB_ROUTES: Record<AppTab, string> = {
      home: "/",
      treinos: "/treinos",
      ranking: "/ranking",
      comunidade: "/comunidade",
      biblioteca: "/biblioteca",
      perfil: "/perfil",
    };
    navigate(TAB_ROUTES[tab]);
  };

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
      case "ranking": return <RankingScreen displayName={displayName} totalXP={totalXP} />;
      case "comunidade": return <CommunityScreen />;
      case "biblioteca": return <LibraryScreen />;
      case "perfil": return <ProfileScreen displayName={displayName} totalXP={totalXP} confidence={confidence} completedPhases={completedPhases.length} totalPhases={PHASES.length} />;
      case "treinos": return renderTreinos();
      default: return renderDashboard();
    }
  };

  const renderChallenge = () => {
    if (mapChallenge) {
      return (
        <div className="fixed inset-0 z-[150] bg-background">
          <div className="p-4 flex items-center justify-between border-b border-border">
             <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">location_on</span>
                <h3 className="font-black uppercase italic">{mapChallenge.name}</h3>
             </div>
             <button onClick={() => setMapChallenge(null)} className="size-10 rounded-full bg-accent flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
             </button>
          </div>
          <div className="flex-1 overflow-y-auto">
              {comboText && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-full shadow-2xl text-xl font-black uppercase italic tracking-wider animate-bounce">
                    {comboText} x{comboCount}
                  </div>
                </div>
              )}
              {comboCount > 0 && (
                <div className="text-center py-2 bg-gradient-to-r from-orange-500/5 to-red-500/5 border-b border-orange-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">
                    🔥 Combo: {comboCount} {comboCount >= 3 ? "• Bônus de XP Ativo!" : ""}
                  </p>
                </div>
              )}
             <div className="max-w-xl mx-auto p-6 pt-12">
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-[32px] mb-8 text-center">
                   <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Simulação Prática</p>
                   <h2 className="text-xl font-bold italic leading-tight">Prepare-se para o desafio de {mapChallenge.name}!</h2>
                </div>
                
                {/* Simple Challenge Logic using the existing InteractiveChallenge if possible, 
                    but for brevity here we'll just show a special card OR reuse it */}
                <div className="space-y-4">
                   {mapChallenge.quizzes.map((quiz: any, idx: number) => (
                      <div key={idx} className="p-6 bg-card border border-border rounded-3xl shadow-sm">
                         <p className="font-bold text-lg mb-4">{quiz.q}</p>
                         <div className="grid grid-cols-1 gap-2">
                            {quiz.options.map((opt: string, i: number) => (
                               <button 
                                 key={i}
                                 onClick={() => {
                                    if (i === quiz.correct) {
                                       const newCombo = comboCount + 1;
                                       setComboCount(newCombo);
                                       playCorrectSound();
                                       
                                       if (newCombo === 3) {
                                          setComboText("FOGO! 🔥");
                                          setTimeout(() => setComboText(""), 2000);
                                          addXP(5);
                                       } else if (newCombo === 5) {
                                          setComboText("IMPARÁVEL! 🏎️");
                                          setTimeout(() => setComboText(""), 2000);
                                          addXP(15);
                                       } else if (newCombo >= 7) {
                                          setComboText("LENDÁRIO! 👑");
                                          setTimeout(() => setComboText(""), 2000);
                                          addXP(25);
                                       }
                                       
                                       if (idx === mapChallenge.quizzes.length - 1) handleMapChallengeComplete();
                                    } else {
                                       setComboCount(0);
                                       setComboText("");
                                       playWrongSound();
                                    }
                                 }}
                                 className="w-full p-4 rounded-2xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left font-medium"
                               >
                                  {opt}
                               </button>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  function renderDashboard() {
    const nextPhaseIdx = completedPhases.length;

    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Daily Bonus Grid */}
        <div id="onboarding-daily-bonus" className="mb-6">
          <DailyBonusGrid 
            currentStreak={streak} 
            onClaimBonus={(day, reward) => {
              if (reward.type === "coins") addCoins(reward.amount);
              if (reward.type === "xp") addXP(reward.amount);
            }}
          />
        </div>

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Módulo 1</p>
          <h1 className="text-2xl font-bold tracking-tight">Primeiros Quilômetros</h1>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex flex-col items-center gap-0 max-w-xs mx-auto">
            {PHASES.map((p, i) => {
              const done = completedPhases.includes(i);
              const locked = i > nextPhaseIdx;
              const isEven = i % 2 === 0;
              const justCompleted = unlockedPhase === i;
              const justUnlocked = unlockedPhase !== null && i === unlockedPhase + 1 && !done;
              return (
                <div key={p.id} className="relative flex flex-col items-center w-full">
                  {i > 0 && <div className={`w-0.5 h-8 ${completedPhases.includes(i - 1) ? "bg-success" : "bg-border"}`} />}
                  <div className={`flex items-center gap-4 w-full ${isEven ? "flex-row" : "flex-row-reverse"}`}>
                    <button
                      id={i === 0 ? "onboarding-first-lesson" : undefined}
                      onClick={() => !locked && startLesson(i)}
                      className={`size-16 rounded-full flex items-center justify-center border-4 ${locked && !justUnlocked ? "bg-muted opacity-50" : done || justCompleted ? "bg-success text-white" : "bg-primary text-white"}`}
                    >
                      <span className="material-symbols-outlined">{locked && !justUnlocked ? "lock" : done || justCompleted ? "check" : "directions_car"}</span>
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{p.title}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Premium courses from admin */}
            {premiumCourses.length > 0 && (
              <>
                <div className="w-0.5 h-8 bg-border" />
                <div className="w-full flex items-center gap-3 px-2 py-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-yellow-500/30" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs filled-icon">diamond</span>
                    Conteúdo Premium
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-yellow-500/30" />
                </div>
              </>
            )}

            {premiumCourses.map((course, i) => {
              const isUnlocked = unlockedCourses.includes(course.id);
              const price = 100 + (i * 50); // Escalating prices
              const isEven = (PHASES.length + i) % 2 === 0;
              return (
                <div key={course.id} className="relative flex flex-col items-center w-full">
                  <div className="w-0.5 h-8 bg-border" />
                  <div className={`flex items-center gap-4 w-full ${isEven ? "flex-row" : "flex-row-reverse"}`}>
                    <button
                      onClick={() => {
                        if (isUnlocked) {
                          navigate(`/curso/${course.id}`);
                        } else {
                          setPurchaseModal({ id: course.id, title: course.title, price });
                        }
                      }}
                      className={`size-16 rounded-full flex items-center justify-center border-4 transition-all ${
                        isUnlocked
                          ? "bg-yellow-500 text-white border-yellow-400 shadow-lg shadow-yellow-500/30"
                          : "bg-gradient-to-br from-yellow-600 to-amber-700 text-white border-yellow-500/50 opacity-80 hover:opacity-100"
                      }`}
                    >
                      <span className="material-symbols-outlined">
                        {isUnlocked ? "play_arrow" : "lock"}
                      </span>
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{course.title}</p>
                      {!isUnlocked && (
                        <p className="text-xs text-yellow-500 font-black flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-xs filled-icon">paid</span>
                          {price} moedas
                        </p>
                      )}
                      {isUnlocked && (
                        <p className="text-xs text-green-500 font-bold flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-xs filled-icon">check_circle</span>
                          Desbloqueado
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lg:w-64">
            <DailyMissions />
          </div>
        </div>
      </div>
    );
  }

  function renderTreinos() {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Mapa da Cidade</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Treinos Práticos</h2>
           </div>
           <div className="flex items-center gap-2 bg-accent px-4 py-2 rounded-2xl border border-border">
              <span className="material-symbols-outlined text-primary text-xl">map</span>
              <span className="text-xs font-bold uppercase tracking-tight">4 Locais Disponíveis</span>
           </div>
        </div>
        
        <DrivingMap onStartTraining={handleStartMapTraining} />
        
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
           {['Estacionamento', 'Ladeiras', 'Rodovias', 'Urbano'].map((t) => (
              <div key={t} className="p-4 rounded-2xl bg-card border border-border text-center">
                 <p className="text-[10px] font-black uppercase text-muted-foreground">{t}</p>
                 <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '0%' }} />
                 </div>
              </div>
           ))}
        </div>
      </div>
    );
  }

  const overlays = (
    <>
      <AnimatePresence>
        {showLevelUp && <LevelUpOverlay level={globalLevel} onClose={() => setShowLevelUp(false)} />}
      </AnimatePresence>
      {showOnboarding && (
        <OnboardingGuide
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem("onboarding_completed", "true");
          }}
          lessonScreen={lessonScreen}
          lessonStep={lessonStep}
          quizAnswered={answered}
        />
      )}
    </>
  );

  if (lessonScreen === "lesson" && phase) {
    return (
      <>
        {overlays}
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
      </>
    );
  }

  if (lessonScreen === "conquest" && phase) {
    return (
      <>
        {overlays}
        <ConquestScreen
          phase={phase}
          unlockedPhase={unlockedPhase}
          coinsEarned={50}
          xpEarned={phase.xp}
          comboHits={comboCount}
          onContinue={handleReturnToDashboard}
        />
      </>
    );
  }

  return (
    <>
      {overlays}
      <AppLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        displayName={displayName}
        confidence={confidence}
        completedPhases={completedPhases.length}
      >
        {renderContent()}
      </AppLayout>
      {renderChallenge()}


      {/* Purchase Modal for Premium Courses */}
      <AnimatePresence>
        {purchaseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-[32px] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="size-20 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-yellow-500/20">
                <span className="material-symbols-outlined text-white text-4xl">lock_open</span>
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight mb-1">Desbloquear Aula</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                <strong className="text-foreground">{purchaseModal.title}</strong>
              </p>

              <div className="bg-accent/50 rounded-2xl p-4 mb-6 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Preço</span>
                  <span className="text-lg font-black text-yellow-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base filled-icon">paid</span>
                    {purchaseModal.price}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Seu saldo</span>
                  <span className={`text-lg font-black flex items-center gap-1 ${coins >= purchaseModal.price ? "text-green-500" : "text-destructive"}`}>
                    <span className="material-symbols-outlined text-base filled-icon">account_balance_wallet</span>
                    {coins}
                  </span>
                </div>
              </div>

              {coins < purchaseModal.price && (
                <p className="text-xs text-destructive font-bold mb-4">
                  ⚠️ Você precisa de mais {purchaseModal.price - coins} moedas!
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPurchaseModal(null)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm border border-border hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const success = await spendCoins(purchaseModal.price);
                    if (success) {
                      const newList = [...unlockedCourses, purchaseModal.id];
                      setUnlockedCourses(newList);
                      localStorage.setItem("unlocked_courses", JSON.stringify(newList));
                      toast.success("Aula desbloqueada! 🎉", { description: purchaseModal.title });
                      playConquestSound();
                      setPurchaseModal(null);
                      navigate(`/curso/${purchaseModal.id}`);
                    }
                  }}
                  disabled={coins < purchaseModal.price}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/20 hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">lock_open</span>
                  Desbloquear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DrivingApp;
