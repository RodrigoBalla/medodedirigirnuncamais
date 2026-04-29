import React, { useState, useEffect } from "react";
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

    const { data: m } = await supabase.from('modules').select('*').eq('product_id', productId).order('order_index');
    if (m && m.length > 0) {
      setModules(m);
      const modIds = m.map(mod => mod.id);
      const { data: less } = await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index');
      if (less) {
         setLessons(less);
         if (less.length > 0) setActiveLessonId(less[0].id);
      }
    }

    if (user) {
       const { data: prog } = await supabase.from('user_progress').select('has_completed_tutorial').eq('user_id', user.id).maybeSingle();
       if (prog) {
          setHasCompletedTutorial(prog.has_completed_tutorial ?? false);
       }
    }

    setLoading(false);
  }

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
                       {/* Video Container (Classic 16:9 Cinema Mode) */}
                       <div className="w-full bg-black aspect-video relative flex flex-col items-center justify-center shadow-2xl xl:rounded-t-3xl overflow-hidden border border-border border-b-0">
                          {activeLesson.video_url ? (
                             <video 
                                key={activeLesson.video_url} 
                                src={activeLesson.video_url} 
                                controls 
                                controlsList="nodownload"
                                className="w-full h-full object-contain"
                                autoPlay
                                onEnded={() => {
                                   if(!isLessonCompleted(activeLesson.id)) {
                                      setShowChallenge(true); // Engatilha o Bandersnatch no final do video
                                   }
                                }}
                             >
                                Seu navegador não suporta vídeos HTML5.
                             </video>
                          ) : (
                             <div className="text-white/40 flex flex-col items-center group">
                                <span className="material-symbols-outlined text-6xl mb-3 group-hover:scale-110 transition-transform">article</span>
                                <p className="font-medium tracking-widest uppercase text-sm">Missão Estática</p>
                             </div>
                          )}
                       </div>
                       
                       {/* Action Toolbar */}
                       <div className="bg-card w-full p-5 border border-border flex justify-end xl:rounded-b-3xl shadow-lg gap-3">
                          <button 
                             onClick={() => {
                                if(isLessonCompleted(activeLesson.id)) {
                                   handleMarkCompleted(); // Just next lesson manually
                                } else {
                                   setShowChallenge(true); // Initiate the Challenge
                                }
                             }}
                             className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md ${
                                isLessonCompleted(activeLesson.id) 
                                  ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)] shadow-none opacity-80'
                                  : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] animate-pulse'
                             }`}
                          >
                             <span className={`material-symbols-outlined text-xl ${isLessonCompleted(activeLesson.id) ? 'filled-icon' : ''}`}>
                                {isLessonCompleted(activeLesson.id) ? 'check_circle' : 'swords'}
                             </span>
                             {isLessonCompleted(activeLesson.id) ? 'Missão Cumprida' : 'Desafiar Meu Destino'}
                          </button>
                       </div>
                       
                       {/* Content Frame */}
                       <div className="bg-card w-full p-6 md:p-8 border-b border-border xl:border xl:rounded-2xl xl:mt-6 shadow-sm mb-10 xl:mb-20">
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

        {/* Sidebar (Modules & Lessons) */}
        <aside className="w-full lg:w-[380px] border-l border-border bg-card flex flex-col shrink-0 lg:h-[calc(100vh-64px)] shadow-xl z-20">
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
