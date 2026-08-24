import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { LessonChallenge, ChallengeOption } from "@/types/lms";
import { toast } from "sonner";
import { 
  playCorrectSound, 
  playWrongSound,
  playCheckSound,
  playConquestSound
} from "@/lib/sounds";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { ShopModal } from "./ShopModal";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  lessonId: string;
  onSuccess: () => void;
  lives: number;
  onLoseLife: () => void;
  onClose: () => void;
}

export function InteractiveChallenge({ lessonId, onSuccess, lives, onLoseLife, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<LessonChallenge | null>(null);
  const [options, setOptions] = useState<ChallengeOption[]>([]);
  
  // Game states
  const [selectedOption, setSelectedOption] = useState<ChallengeOption | null>(null);
  const [showConsequence, setShowConsequence] = useState(false);
  const [isSlidingUp, setIsSlidingUp] = useState(false);

  // Lifelines
  const { spendCoins } = useUserProgress();
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
     fetchChallenge();
     if (!localStorage.getItem('saw_inseguranca_tutorial')) {
       setShowTutorial(true);
     }
  }, [lessonId]);

  async function fetchChallenge() {
     setLoading(true);
     const { data: q } = await supabase.from('lesson_challenges').select('*').eq('lesson_id', lessonId).maybeSingle();
     if (q) {
        setChallenge(q);
        const { data: opts } = await supabase.from('challenge_options').select('*').eq('challenge_id', q.id).order('created_at');
        if (opts) setOptions(opts);
     }
     setLoading(false);
  }


  const handleSelectOption = (opt: ChallengeOption) => {
     if (showConsequence) return; // Block fast clicking
     if (lives <= 0) {
        toast.error("Você não tem mais Vidas! Restaure ou aguarde 24 horas.");
        return;
     }

     setSelectedOption(opt);

     if (opt.is_correct) {
        playCorrectSound();
        // Fire onSuccess sequence (Roulette will be hooked here later, for now just success)
        toast.success("✅ Escolha Perfeita!", { duration: 2000 });
        setTimeout(() => {
           onSuccess();
        }, 1500);
     } else {
        playWrongSound();
        setTimeout(() => {
           onLoseLife();
           setShowConsequence(true);
        }, 500);
     }
  };

  const handleSlideUp = () => {
     setIsSlidingUp(true);
     setTimeout(() => {
        setShowConsequence(false);
        setIsSlidingUp(false);
        setSelectedOption(null); // Reset to try again
     }, 600); // Wait for transition
  };

  const handle5050 = async () => {
     if (eliminatedOptions.length > 0) return;
     const success = await spendCoins(15);
     if (!success) { setShowShop(true); return; }
     
     const wrongOpts = options.filter(o => !o.is_correct);
     // Elimina todas as erradas menos 1
     const toEliminate = wrongOpts.slice(0, wrongOpts.length - 1).map(o => o.id);
     setEliminatedOptions(toEliminate);
     toast.success("Opções erradas apagadas!", { icon: "✂️" });
  };

  const handleSkip = async () => {
     const success = await spendCoins(40);
     if (!success) { setShowShop(true); return; }

     toast.success("Que alívio! Avanço garantido.", { icon: "🚀" });
     playCheckSound();
     setTimeout(() => { onSuccess(); }, 1500);
  };

  const closeTutorial = () => {
     setShowTutorial(false);
     localStorage.setItem('saw_inseguranca_tutorial', 'true');
     playCheckSound();
  };

  if (loading) return (
     <div className="w-full py-20 flex justify-center"><div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" /></div>
  );

  if (!challenge || options.length === 0) {
     return (
        <div className="w-full text-center py-12 bg-card rounded-2xl border border-border">
           <p className="text-muted-foreground mb-4">Ainda não há um Desafio cadastrado para esta lição.</p>
           <button onClick={onSuccess} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90">
             Marcar como Lida Manualmente
           </button>
        </div>
     );
  }

  return (
    <div className="relative w-full overflow-hidden bg-card rounded-2xl border border-border shadow-2xl transition-all duration-700 mx-auto max-w-2xl min-h-[400px]">
       
       {/* 1. LAYER PRINCIPAL: A PERGUNTA */}
       <div className={`p-6 md:p-10 transition-all duration-500 flex flex-col items-center min-h-[400px] ${showConsequence ? 'scale-95 blur-md opacity-20' : 'scale-100 blur-0 opacity-100'}`}>
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
             <span className="material-symbols-outlined text-4xl text-primary">casino</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-center text-foreground mb-8 leading-tight">
             {challenge.question_text}
          </h2>

          <div className="w-full space-y-3 relative z-10">
             {options.map((opt) => {
                if (eliminatedOptions.includes(opt.id)) {
                   // Oculta completamente a opção eliminada do fluxo
                   return null; 
                }
                
                return (
                   <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt)}
                      className={`w-full text-left p-5 rounded-xl border-2 font-bold text-lg transition-all
                        ${selectedOption?.id === opt.id && opt.is_correct ? 'border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] scale-[1.02]' 
                        : selectedOption?.id === opt.id && !opt.is_correct ? 'border-destructive bg-destructive/10 text-destructive scale-[1.02]' 
                        : 'border-border bg-background hover:border-primary hover:bg-accent'}
                      `}
                   >
                      {opt.option_text}
                   </button>
                )
             })}
          </div>
          
          {/* Lifelines Toolbar */}
          <div className="w-full mt-8 pt-6 border-t border-border flex flex-col items-center gap-3 relative z-10">
             <p className="text-xs uppercase font-black text-muted-foreground tracking-widest">Sentiu o brancão? Use uma ajuda</p>
             <div className="flex gap-4 w-full">
                <button 
                  onClick={handle5050}
                  disabled={eliminatedOptions.length > 0}
                  className="flex-1 flex flex-col items-center justify-center p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 hover:bg-orange-500/20 transition-colors disabled:opacity-50 disabled:grayscale"
                >
                   <span className="material-symbols-outlined text-2xl mb-1">cut</span>
                   <span className="font-bold text-sm">Corta 50/50</span>
                   <div className="flex items-center gap-1 mt-1 bg-background/50 px-2 rounded-full text-[10px]">
                      <span className="material-symbols-outlined text-[10px] filled-icon text-yellow-500">database</span> 15
                   </div>
                </button>
                <button 
                  onClick={handleSkip}
                  className="flex-1 flex flex-col items-center justify-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors"
                >
                   <span className="material-symbols-outlined text-2xl mb-1">rocket_launch</span>
                   <span className="font-bold text-sm">Pular Sufoco</span>
                   <div className="flex items-center gap-1 mt-1 bg-background/50 px-2 rounded-full text-[10px]">
                      <span className="material-symbols-outlined text-[10px] filled-icon text-yellow-500">database</span> 40
                   </div>
                </button>
             </div>
          </div>

          <button onClick={onClose} className="mt-8 text-sm font-bold text-muted-foreground hover:text-foreground relative z-10">Voltar para o Vídeo</button>
          
          {/* TUTORIAL DE INSEGURANÇA (OVERLAY LOCAL) */}
          <AnimatePresence>
            {showTutorial && (
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-12 px-6 bg-black/80 backdrop-blur-sm rounded-2xl"
               >
                 <motion.div 
                   initial={{ y: 20, scale: 0.9 }}
                   animate={{ y: 0, scale: 1 }}
                   className="bg-card border-2 border-primary shadow-2xl p-6 rounded-2xl max-w-sm text-center relative"
                 >
                   <div className="absolute -top-12 left-1/2 -translate-x-1/2 size-20 rounded-full bg-primary flex items-center justify-center border-4 border-card shadow-lg">
                      <span className="material-symbols-outlined text-4xl text-primary-foreground">psychology_alt</span>
                   </div>
                   <h3 className="text-xl font-black mt-6 mb-2">Bateu a incerteza?</h3>
                   <p className="text-sm text-muted-foreground mb-6">
                     No trânsito real, o medo nos congela. Mas aqui você não precisa chutar e arriscar perder suas Vidas! <br/><br/>
                     Use as moedas que você ganhou e compre <b>Poderes de Ajuda</b> que estão ali atrás piscando. Eles salvam corações!
                   </p>
                   <button onClick={closeTutorial} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-transform active:scale-95 shadow-md">
                     Entendi, Mestre!
                   </button>
                 </motion.div>
                 
                 {/* Foco visual apontando para a toolbar */}
                 <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 animate-bounce">
                    <span className="material-symbols-outlined text-4xl text-primary drop-shadow-lg">arrow_downward</span>
                 </div>
               </motion.div>
            )}
          </AnimatePresence>

       </div>

       {/* 2. LAYER PUNITIVA: VÍDEO VERTICAL (BANDERSNATCH) */}
       {showConsequence && selectedOption && (
          <div className={`absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center pointer-events-auto transition-transform duration-500 ease-in-out ${isSlidingUp ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
             
             {/* Texto Sangrando no Topo */}
             <div className="absolute top-8 left-0 right-0 text-center animate-in fade-in zoom-in duration-1000 z-20">
                <h1 className="text-3xl md:text-5xl font-black text-red-600 tracking-widest drop-shadow-[0_0_15px_rgba(220,38,38,0.8)] uppercase">Veja Seu Destino</h1>
                <p className="text-white/60 text-sm mt-2 font-bold">Você fez a escolha errada. ❤️ -1 Vida</p>
             </div>

             {/* Container de Vídeo Estilo TikTok */}
             <div className="w-full h-full max-w-sm mx-auto flex items-center justify-center relative shadow-[0_0_50px_rgba(220,38,38,0.15)] bg-black px-4 pt-24 pb-20">
                {selectedOption.destination_video_url ? (
                   <video 
                     src={selectedOption.destination_video_url} 
                     autoPlay 
                     playsInline 
                     className="w-full h-auto max-h-full object-contain rounded-xl border border-white/10"
                     onEnded={() => {
                        // Poderia subir automático, mas vamos deixar o aluno processar o erro e deslizar 
                     }}
                   />
                ) : (
                   <div className="text-center text-white/50">
                      <span className="material-symbols-outlined text-6xl mb-4">broken_image</span>
                      <p>O administrador da autoescola esqueceu de cadastrar o vídeo assustador dessa batida.</p>
                   </div>
                )}
             </div>

             {/* Botão Inferior Deslizar Estilo Reels */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 animate-bounce">
                 <button 
                   onClick={handleSlideUp}
                   className="flex flex-col items-center justify-center text-white/70 hover:text-white transition-colors group cursor-pointer"
                 >
                    <span className="material-symbols-outlined text-4xl group-hover:-translate-y-2 transition-transform">keyboard_double_arrow_up</span>
                    <span className="text-xs font-bold tracking-widest uppercase">Deslize para Sobreviver</span>
                 </button>
              </div>
           </div>
        )}

        <ShopModal isOpen={showShop} onClose={() => setShowShop(false)} />


    </div>
  );
}
