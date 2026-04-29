import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onComplete: () => void;
}

export function PlayerTutorial({ onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  const steps = [
    { 
       title: "Bem-vindo ao Trânsito Real!", 
       content: "Esqueça cursos chatos e parados. Aqui, as suas decisões na plataforma moldam o seu destino nas ruas.", 
       icon: "local_taxi",
       color: "text-primary",
       bg: "bg-primary/10"
    },
    { 
       title: "Suas Vidas e Consequências", 
       content: "Você recebe 5 Vidas (❤️) por dia. Toda vez que tomar uma decisão perigosa nos desafios práticos, você perde 1 vida e assiste a consequência assustadora da sua falha.", 
       icon: "favorite",
       color: "text-destructive",
       bg: "bg-destructive/10"
    },
    { 
       title: "A Riqueza e a Roleta", 
       content: "Ao acertar as decisões sagazes, você acumula Moedas (🪙) e gira a nossa Roleta da Sorte para desbloquear conteúdos proibidos e módulos premiums.", 
       icon: "monetization_on",
       color: "text-amber-500",
       bg: "bg-amber-500/10"
    },
    { 
       title: "O Seu Primeiro Teste", 
       content: "Assista sua primeira aula agora. Quando terminar, não tem botão de concluir. O botão se chama 'Desafiar Meu Destino'. Prepare-se.", 
       icon: "sports_esports",
       color: "text-[hsl(var(--success))]",
       bg: "bg-[hsl(var(--success))/10]"
    }
  ];

  const current = steps[step];

  const handleNext = async () => {
    if (step < steps.length - 1) {
       setStep(s => s + 1);
    } else {
       if (user) {
         // Salva no banco que ele não precisa ver o tutorial de novo
         await supabase.from('user_progress').update({ has_completed_tutorial: true }).eq('user_id', user.id);
       }
       onComplete();
    }
  }

  return (
    <div className="fixed inset-0 z-[999] bg-background/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
       <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Progress Indicator */}
          <div className="flex gap-2 absolute top-0 left-0 right-0 p-4">
             {steps.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
             ))}
          </div>

          <div className="mt-6 flex flex-col items-center text-center animate-in slide-in-from-bottom-4 slide-in-from-right-4 duration-500" key={step}>
             <div className={`size-24 rounded-full flex items-center justify-center mb-6 shadow-xl ${current.bg}`}>
                <span className={`material-symbols-outlined text-5xl filled-icon ${current.color}`}>
                   {current.icon}
                </span>
             </div>
             
             <h2 className="text-2xl font-black mb-4 tracking-tight text-foreground">
                {current.title}
             </h2>
             
             <p className="text-muted-foreground leading-relaxed mb-8">
                {current.content}
             </p>

             <button 
                onClick={handleNext}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 hover:scale-[1.02] shadow-xl shadow-primary/20 transition-all active:scale-95"
             >
                {step === steps.length - 1 ? "Entrar na Arena" : "Entendi, Próximo"}
             </button>
          </div>
       </div>
    </div>
  );
}
