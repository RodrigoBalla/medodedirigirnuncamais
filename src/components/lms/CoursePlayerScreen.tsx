import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Product, Module, Lesson } from "@/types/lms";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { PlayerTutorial } from "./PlayerTutorial";
import { InteractiveChallenge } from "./InteractiveChallenge";
import { LuckRoulette } from "./LuckRoulette";
import { GameOverModal } from "./GameOverModal";
import { motion, AnimatePresence } from "framer-motion";
import { VideoPlayer, parseVideoUrl, type VideoPlayerHandle } from "./VideoPlayer";
import { LessonComments } from "./LessonComments";
import { AutoplayCountdown } from "./AutoplayCountdown";
import { ReportProblemButton } from "./ReportProblemButton";
import { useAntiPiracy } from "@/hooks/useAntiPiracy";
import { useVideoKeyboardShortcuts } from "@/hooks/useVideoKeyboardShortcuts";
import { useTeacherOnline } from "@/hooks/useTeacherPresence";
import { StreakBadge } from "./StreakBadge";

interface Props {
  productId: string;
  onBack: () => void;
}

export function CoursePlayerScreen({ productId, onBack }: Props) {
  const { user } = useAuth();
  const { lives, coins, totalXP, loseLife, addCoins, completeLesson, completedLessons } = useUserProgress();
  const [product, setProduct] = useState<Product | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  
  // Progress States
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(true); 
  
  // Game States
  const [loading, setLoading] = useState(true);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  // Progresso individual de aula (resume position) — Map<lessonId, seconds>
  const [progressByLesson, setProgressByLesson] = useState<Map<string, number>>(new Map());
  // Posição atual no vídeo (atualizada via onProgress) — usada pra timestamp de comentários
  const currentTimeRef = useRef<number>(0);

  // ─── Modo foco / Auto-play / Anti-pirataria / Atalhos ──────────────────────
  // Modo foco: esconde sidebar, comentários e info pra deixar só vídeo+toolbar
  const [focusMode, setFocusMode] = useState(false);
  // Auto-play da próxima aula: countdown 5s ao final do vídeo
  const [showAutoplay, setShowAutoplay] = useState(false);
  // Ref pro player — usada pelos atalhos de teclado e botão PiP
  const playerHandleRef = useRef<VideoPlayerHandle | null>(null);

  // Detecta DevTools, bloqueia right-click, captura de tela
  const { blocked: piracyBlocked, reason: piracyReason, reset: resetPiracy } = useAntiPiracy();

  // Indicador "Carla online" — badge no header
  const carlaOnline = useTeacherOnline();

  // Atalhos de teclado (espaço/setas/F/M/C)
  const playerActions = useMemo(() => ({
    togglePlay:       () => playerHandleRef.current?.togglePlay(),
    seek:             (d: number) => playerHandleRef.current?.seek(d),
    setVolumeDelta:   (d: number) => playerHandleRef.current?.setVolumeDelta(d),
    toggleMute:       () => playerHandleRef.current?.toggleMute(),
    toggleFullscreen: () => playerHandleRef.current?.toggleFullscreen(),
    toggleFocusMode:  () => setFocusMode((f) => !f),
  }), []);
  useVideoKeyboardShortcuts(playerActions, true);

  useEffect(() => {
    loadCourse();
  }, [productId, user]);

  useEffect(() => {
     if (lives <= 0 && showChallenge) {
        setShowGameOver(true);
     }
  }, [lives, showChallenge]);

  async function loadCourse() {
    setLoading(true);
    const { data: p } = await supabase.from('products').select('*').eq('id', productId).single();
    if (p) setProduct(p);

    let lessonList: Lesson[] = [];
    const { data: m } = await supabase.from('modules').select('*').eq('product_id', productId).order('order_index');
    if (m && m.length > 0) {
      setModules(m);
      const modIds = m.map(mod => mod.id);
      const { data: less } = await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index');
      if (less) {
         setLessons(less);
         lessonList = less as Lesson[];
      }
    }

    if (user) {
       const { data: prog } = await supabase.from('user_progress').select('has_completed_tutorial').eq('user_id', user.id).maybeSingle();
       if (prog) {
          setHasCompletedTutorial(prog.has_completed_tutorial ?? false);
       }

       // Carrega lesson_progress (posição + flags) pra retomar de onde parou
       if (lessonList.length > 0) {
         const { data: lp } = await supabase
           .from('lesson_progress')
           .select('lesson_id, position_seconds, completed')
           .eq('user_id', user.id)
           .in('lesson_id', lessonList.map(l => l.id));
         const map = new Map<string, number>();
         (lp ?? []).forEach((row: { lesson_id: string; position_seconds: number }) => {
           map.set(row.lesson_id, Number(row.position_seconds) || 0);
         });
         setProgressByLesson(map);

         // Aula inicial: a primeira não concluída com posição salva, ou a primeira do curso
         const completedSet = new Set((lp ?? []).filter((r: any) => r.completed).map((r: any) => r.lesson_id));
         const firstUnfinished = lessonList.find((l) => !completedSet.has(l.id));
         setActiveLessonId((firstUnfinished ?? lessonList[0]).id);
       } else {
         setActiveLessonId(null);
       }
    } else if (lessonList.length > 0) {
       setActiveLessonId(lessonList[0].id);
    }

    setLoading(false);
  }

  // Salva progresso (posição) no banco — chamado a cada ~5s pelo VideoPlayer
  const saveLessonProgress = useCallback(
    async (lessonId: string, seconds: number, durationSeconds: number) => {
      if (!user || !lessonId) return;
      currentTimeRef.current = seconds;
      try {
        await supabase.from('lesson_progress').upsert({
          user_id: user.id,
          lesson_id: lessonId,
          position_seconds: Math.max(0, Math.floor(seconds)),
          duration_seconds: durationSeconds > 0 ? durationSeconds : null,
        }, { onConflict: 'user_id,lesson_id' });
        // Atualiza cache local
        setProgressByLesson((prev) => {
          const next = new Map(prev);
          next.set(lessonId, seconds);
          return next;
        });
      } catch (err) {
        // Falha silenciosa — progresso é best-effort
        console.warn('[lesson-progress] save error:', err);
      }
    },
    [user],
  );

  // Marca aula como concluída no banco (lesson_progress) e dispara avanço
  const handleLessonAutoComplete = useCallback(async () => {
    if (!activeLessonId || !user) return;
    if (isLessonCompleted(activeLessonId)) {
      // Já concluída — abre countdown direto
      const idx = lessons.findIndex((l) => l.id === activeLessonId);
      if (idx >= 0 && idx < lessons.length - 1) setShowAutoplay(true);
      return;
    }
    try {
      await supabase.from('lesson_progress').upsert({
        user_id: user.id,
        lesson_id: activeLessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' });
    } catch (err) {
      console.warn('[lesson-progress] complete error:', err);
    }
    await completeLesson(activeLessonId); // atualiza UserProgressContext (XP, badges)
    // Toast premium com recompensa visual — substitui o "indo pra próxima"
    toast.success("Aula concluída!", {
      description: "+1 ⭐ XP · +5 🪙 moedas",
      duration: 3500,
    });
    // Dispara overlay de auto-play da próxima aula (estilo Netflix)
    const idx = lessons.findIndex((l) => l.id === activeLessonId);
    if (idx >= 0 && idx < lessons.length - 1) {
      setShowAutoplay(true);
    } else {
      toast("🎉 Parabéns! Você concluiu todas as aulas deste curso!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId, user, lessons]);

  function goToNextLesson() {
    setShowAutoplay(false);
    const idx = lessons.findIndex((l) => l.id === activeLessonId);
    if (idx >= 0 && idx < lessons.length - 1) {
      setActiveLessonId(lessons[idx + 1].id);
    } else {
      toast('🎉 Parabéns! Você concluiu todas as aulas deste curso!');
    }
  }

  // Próxima aula (pra título do AutoplayCountdown)
  const nextLesson = useMemo(() => {
    const idx = lessons.findIndex((l) => l.id === activeLessonId);
    return idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  }, [lessons, activeLessonId]);

  const isLessonCompleted = (lessonId: string) => completedLessons.includes(lessonId);

  const handleLoseLife = async () => {
     await loseLife();
     if (lives <= 1) {
        setShowGameOver(true);
     }
  }

  const handleChallengeSuccess = async () => {
     setShowChallenge(false);
     setShowRoulette(true); // Open the roulette
  }

  const onRouletteComplete = async () => {
     setShowRoulette(false);
     await handleMarkCompleted();
  };

  const handleMarkCompleted = async () => {
    if (!activeLessonId || !user) return;
    
    if (!isLessonCompleted(activeLessonId)) {
      await completeLesson(activeLessonId);
    }

    // Advance
    const currentIndex = lessons.findIndex(l => l.id === activeLessonId);
    if (currentIndex >= 0 && currentIndex < lessons.length - 1) {
       setActiveLessonId(lessons[currentIndex + 1].id);
    } else {
       toast("🎉 Parabéns! Você concluiu todas as aulas deste curso!");
    }
  }

  const activeLesson = lessons.find(l => l.id === activeLessonId);
  const totalLessons = lessons.length;
  const completedInCourse = lessons.filter(l => isLessonCompleted(l.id)).length;
  const progressPercent = totalLessons === 0 ? 0 : Math.round((completedInCourse / totalLessons) * 100);

  if (loading) {
     return (
       <div className="min-h-screen bg-background flex flex-col items-center justify-center text-primary">
         <div className="animate-spin size-12 border-4 border-primary border-t-transparent flex items-center justify-center rounded-full mb-6 shadow-lg shadow-primary/20"/>
         <p className="font-bold animate-pulse text-lg">Iniciando Ambiente de Estudos...</p>
       </div>
     );
  }

  if (!product) {
     return (
       <div className="min-h-screen bg-background flex flex-col items-center justify-center">
         <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">error</span>
         <p className="font-bold text-xl mb-6">Curso não encontrado.</p>
         <button onClick={onBack} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors">Voltar para Biblioteca</button>
       </div>
     );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <AnimatePresence>
         {!hasCompletedTutorial && <PlayerTutorial onComplete={() => setHasCompletedTutorial(true)} />}
         {showRoulette && <LuckRoulette onComplete={onRouletteComplete} />}
         {showGameOver && <GameOverModal onBack={onBack} onReset={() => setShowGameOver(false)} />}
      </AnimatePresence>

      {/* Aviso anti-pirataria: detecção de DevTools / captura de tela.
          Não bloqueia a aula, mas exibe aviso "esta sessão está sendo monitorada"
          + log no banco (futuro). User pode fechar e continuar. */}
      {piracyBlocked && (
         <div className="fixed inset-x-0 top-0 z-[200] bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-3 shadow-lg">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>
               {piracyReason} — sua sessão é registrada com seu email/IP. Distribuir o conteúdo
               viola os termos de uso.
            </span>
            <button
               onClick={resetPiracy}
               className="underline hover:no-underline ml-2"
            >
               Entendi
            </button>
         </div>
      )}

      {/* Header Premium & Economy */}
      <header className="h-16 border-b border-border bg-card shadow-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
         <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center justify-center size-10 rounded-full border border-border bg-background hover:bg-accent transition-all group" title="Voltar">
               <span className="material-symbols-outlined text-muted-foreground group-hover:text-foreground">arrow_back</span>
            </button>
            <div className="hidden sm:block">
               <h1 className="font-bold text-base line-clamp-1 break-all">{product.title}</h1>
               <p className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-1">
                 <span className="material-symbols-outlined text-[12px] filled-icon">school</span>
                 Arena Interativa
               </p>
            </div>
         </div>

         <div className="flex items-center gap-3">
            {/* Streak diário — 🔥 X dias */}
            <StreakBadge />
            {/* Carla online — badge real-time via Supabase Presence */}
            {carlaOnline && (
               <div
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  title="A Carla está online agora"
               >
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Carla online</span>
               </div>
            )}
            {/* Vidas ❤️ */}
            <motion.div 
               animate={lives <= 1 ? { scale: [1, 1.1, 1] } : {}}
               transition={{ repeat: Infinity, duration: 1 }}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-border bg-accent/40 ${lives <= 1 ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
            >
               <span className={`material-symbols-outlined text-red-600 filled-icon ${lives <= 1 ? 'animate-bounce' : ''}`}>favorite</span>
               <span className="text-sm font-black text-foreground">{lives}</span>
            </motion.div>

            {/* Moedas 🪙 */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-border bg-accent/40 font-bold text-amber-500">
               <span className="material-symbols-outlined filled-icon text-lg">database</span> 
               <span className="text-sm md:text-base">{coins}</span>
            </div>

            <div className="hidden md:flex flex-col items-end ml-4">
              <div className="flex items-center gap-2">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Progresso</p>
                 <span className="text-[9px] bg-primary/20 text-primary font-black px-1.5 py-0.5 rounded leading-none">{completedInCourse}/{totalLessons}</span>
              </div>
              <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden border border-border/50">
                <div className="h-full bg-[hsl(var(--success))] rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
         </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        {/* Main Content Area (Video OR Challenge) */}
        <main className="flex-1 overflow-y-auto bg-black/5 flex flex-col items-center custom-scrollbar">
           {activeLesson ? (
              <div className="w-full max-w-6xl mx-auto xl:px-8 xl:py-6">
                 
                 {/* Se estiver no Modo Desafio, substituimos o conteudo central pelo Player de Desafio */}
                 {showChallenge ? (
                    <div className="animate-in fade-in zoom-in duration-500">
                       <InteractiveChallenge 
                          lessonId={activeLesson.id}
                          lives={lives}
                          onLoseLife={handleLoseLife}
                          onSuccess={handleChallengeSuccess}
                          onClose={() => setShowChallenge(false)}
                       />
                    </div>
                 ) : (
                    <>
                       {/* Video Container — VideoPlayer abstrai YouTube/Vimeo/MP4 com auto-complete + resume */}
                       <div className="w-full bg-black aspect-video relative flex flex-col items-center justify-center shadow-2xl xl:rounded-t-3xl overflow-hidden border border-border border-b-0">
                          <VideoPlayer
                             ref={playerHandleRef}
                             embed={parseVideoUrl(activeLesson.video_url)}
                             startAt={progressByLesson.get(activeLesson.id) ?? 0}
                             viewerId={user?.email || user?.id}
                             onProgress={(seconds, duration) => {
                                saveLessonProgress(activeLesson.id, seconds, duration);
                             }}
                             onDurationChange={() => { /* duração já é capturada no onProgress */ }}
                             onEnded={handleLessonAutoComplete}
                          />
                          {/* Auto-play overlay (countdown 5s pra próxima aula) */}
                          <AnimatePresence>
                             {showAutoplay && nextLesson && (
                                <AutoplayCountdown
                                   nextTitle={nextLesson.title}
                                   onAdvance={goToNextLesson}
                                   onCancel={() => setShowAutoplay(false)}
                                />
                             )}
                          </AnimatePresence>
                       </div>
                       
                       {/* Action Toolbar — controles do player + concluir aula */}
                       <div className="bg-card w-full p-5 border border-border flex flex-wrap justify-between items-center xl:rounded-b-3xl shadow-lg gap-3">
                          {/* Esquerda: ações do player */}
                          <div className="flex items-center gap-2 flex-wrap">
                             <button
                                onClick={() => setFocusMode((f) => !f)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border transition-colors ${
                                   focusMode
                                     ? "bg-primary/10 text-primary border-primary/40"
                                     : "text-muted-foreground hover:text-foreground border-border hover:bg-accent"
                                }`}
                                title="Modo foco — esconde a barra lateral (atalho: C)"
                             >
                                <span className="material-symbols-outlined text-base">
                                   {focusMode ? "fullscreen_exit" : "center_focus_strong"}
                                </span>
                                {focusMode ? "Sair do foco" : "Modo foco"}
                             </button>
                             <button
                                onClick={() => playerHandleRef.current?.togglePictureInPicture()}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
                                title="Picture-in-picture (mini player)"
                             >
                                <span className="material-symbols-outlined text-base">picture_in_picture_alt</span>
                                PiP
                             </button>
                             <ReportProblemButton
                                lessonId={activeLesson.id}
                                getCurrentTime={() => playerHandleRef.current?.getCurrentTime() ?? currentTimeRef.current}
                             />
                             <span
                                className="hidden md:inline text-[10px] text-muted-foreground/70 font-mono ml-2"
                                title="Atalhos: Espaço/K play · ←/→ ±10s · ↑/↓ volume · M mute · F fullscreen · C foco"
                             >
                                ⌨ Espaço · ← → · F · C
                             </span>
                          </div>
                          {/* Direita: concluir aula */}
                          <button
                             onClick={() => {
                                if (!isLessonCompleted(activeLesson.id)) handleMarkCompleted();
                             }}
                             disabled={isLessonCompleted(activeLesson.id)}
                             className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md ${
                                isLessonCompleted(activeLesson.id)
                                  ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)] shadow-none opacity-80 cursor-default'
                                  : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
                             }`}
                          >
                             <span className={`material-symbols-outlined text-xl ${isLessonCompleted(activeLesson.id) ? 'filled-icon' : ''}`}>
                                {isLessonCompleted(activeLesson.id) ? 'check_circle' : 'check'}
                             </span>
                             {isLessonCompleted(activeLesson.id) ? 'Aula Concluída' : 'Concluir Aula'}
                          </button>
                       </div>
                       
                       {/* Content Frame — escondido em modo foco */}
                       {!focusMode && (
                       <div className="bg-card w-full p-6 md:p-8 border-b border-border xl:border xl:rounded-2xl xl:mt-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-1">
                                MISSÃO ATUAL
                             </span>
                          </div>
                          <h2 className="text-2xl md:text-3xl font-black mb-6 text-foreground tracking-tight">{activeLesson.title}</h2>
                          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                             {activeLesson.content || "Nenhum material de apoio para esta missão."}
                          </div>
                       </div>
                       )}

                       {/* Comentários da aula — escondidos em modo foco */}
                       {!focusMode && (
                       <div className="bg-card w-full px-4 md:px-8 pt-2 pb-8 xl:rounded-2xl xl:mt-4 xl:px-8 xl:py-6 mb-10 xl:mb-20">
                          <LessonComments lessonId={activeLesson.id} />
                       </div>
                       )}
                    </>
                 )}
              </div>
           ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                 <div className="size-24 rounded-full bg-accent flex items-center justify-center mb-6">
                   <span className="material-symbols-outlined text-5xl opacity-50">videocam_off</span>
                 </div>
                 <p className="font-bold text-lg">Nenhuma missão selecionada.</p>
                 <p className="text-sm opacity-70">Utilize o radar lateral para escolher seu próximo desafio.</p>
              </div>
           )}
        </main>

        {/* Sidebar (Modules & Lessons) — escondida em modo foco */}
        <aside className={`${focusMode ? "hidden" : "w-full lg:w-[380px]"} border-l border-border bg-card flex flex-col shrink-0 lg:h-[calc(100vh-64px)] shadow-xl z-20`}>
           <div className="p-5 border-b border-border hidden lg:block bg-gradient-to-r from-primary/5 to-transparent">
              <h3 className="font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary text-xl">map</span>
                 Radar de Módulos
              </h3>
           </div>
           
           <div className="flex-1 overflow-y-auto w-full hide-scrollbar">
              {modules.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                    <p className="text-sm">O mapa de missões está sendo construído.</p>
                 </div>
              ) : (
                 <div className="divide-y divide-border">
                    {modules.map((mod, modIdx) => {
                       const modLessons = lessons.filter(l => l.module_id === mod.id);
                       return (
                          <div key={mod.id} className="bg-card group">
                             <div className="px-5 py-4 bg-background sticky top-0 z-10 border-b border-border flex justify-between items-center transition-colors shadow-sm cursor-pointer" onClick={() => {}}>
                                <h4 className="font-bold text-[12px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-2">
                                   <span className="size-5 rounded bg-accent/50 flex items-center justify-center text-[10px]">{modIdx + 1}</span>
                                   {mod.title}
                                </h4>
                                <span className="text-[10px] font-bold text-foreground bg-accent px-2 py-1 rounded-md border border-border shadow-sm">{modLessons.length} missões</span>
                             </div>
                             
                             <div className="flex flex-col">
                                {modLessons.map((lesson, idx) => {
                                   const isActive = activeLessonId === lesson.id;
                                   const isDone = isLessonCompleted(lesson.id);
                                   return (
                                      <button 
                                        key={lesson.id} 
                                        onClick={() => {
                                            setActiveLessonId(lesson.id);
                                            setShowChallenge(false);
                                        }}
                                        className={`flex items-start gap-4 px-5 py-4 text-left transition-all relative ${
                                           isActive 
                                             ? 'bg-primary/5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary' 
                                             : 'hover:bg-accent/50'
                                        }`}
                                      >
                                         <div className={`mt-0.5 size-8 rounded-full flex items-center justify-center shrink-0 transition-all border-2 ${
                                           isActive && !isDone ? 'border-primary bg-background text-primary shadow-lg shadow-primary/30 scale-110' 
                                           : isDone ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white shadow-md' 
                                           : 'border-muted-foreground/30 bg-background text-muted-foreground'
                                         }`}>
                                            <span className={`material-symbols-outlined text-[16px] ${isDone || isActive ? 'filled-icon' : ''}`}>
                                               {isDone ? 'check' : lesson.video_url ? 'play_arrow' : 'article'}
                                            </span>
                                         </div>
                                         <div className="flex-1 pt-1.5">
                                            <p className={`text-sm font-bold leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>
                                               {lesson.title}
                                            </p>
                                         </div>
                                      </button>
                                   )
                                })}
                                {modLessons.length === 0 && (
                                   <div className="px-5 py-6 text-center text-xs text-muted-foreground italic">
                                      Área ainda bloqueada (vazia).
                                   </div>
                                 )}
                             </div>
                          </div>
                       )
                    })}
                 </div>
              )}
           </div>
        </aside>
      </div>
    </div>
  );
}
