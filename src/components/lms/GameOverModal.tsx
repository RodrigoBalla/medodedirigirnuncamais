import { motion } from "framer-motion";
import { toast } from "sonner";
import { useEffect } from "react";
import { playWrongSound } from "@/lib/sounds";

interface Props {
  onReset: () => void;
  onBack: () => void;
}

export function GameOverModal({ onReset, onBack }: Props) {
  useEffect(() => {
    playWrongSound();
  }, []);

  const handleShare = () => {
    const text = encodeURIComponent("Preciso de vidas no Medo de Dirigir Nunca Mais! Alguém me ajuda? 🚗💨");
    window.open(`https://wa.me/?text=${text}`, "_blank");
    toast.success("Link enviado! Peça para alguém clicar e você ganhará +1 vida.");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
      <div className="max-w-md w-full bg-card border-2 border-destructive rounded-3xl p-10 text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]">
        <div className="size-24 rounded-full bg-destructive/10 mx-auto flex items-center justify-center mb-6 animate-pulse">
          <span className="material-symbols-outlined text-6xl text-destructive filled-icon">heart_broken</span>
        </div>
        
        <h2 className="text-4xl font-black text-foreground mb-2 uppercase tracking-tighter italic">GAME OVER</h2>
        <p className="text-muted-foreground font-medium mb-10 leading-relaxed">
          Suas energias acabaram! Você fez escolhas perigosas demais para continuar agora.
        </p>

        <div className="space-y-4">
          <button 
            onClick={handleShare}
            className="w-full bg-[#25D366] text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_0_0_#128C7E] active:translate-y-1 active:shadow-none hover:bg-[#25D366]/90 transition-all uppercase tracking-widest text-sm"
          >
            <span className="material-symbols-outlined filled-icon">share</span>
            Pedir Vidas no WhatsApp
          </button>

          <button 
            className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_0_0_rgba(var(--primary-rgb),0.5)] active:translate-y-1 active:shadow-none hover:bg-primary/90 transition-all uppercase tracking-widest text-sm"
            onClick={() => toast.info("Link de PIX gerado! (Simulação)")}
          >
             Restaurar Agora (R$ 9,90) ⚡
          </button>

          <button 
            onClick={onBack}
            className="w-full bg-transparent text-muted-foreground font-bold py-3 hover:text-foreground transition-colors text-sm"
          >
            Voltar para Biblioteca
          </button>
        </div>

        <p className="mt-8 text-[11px] text-muted-foreground uppercase tracking-widest opacity-50">
          Suas 5 vidas serão restauradas automaticamente em <span className="text-foreground font-bold">24 horas</span>.
        </p>
      </div>
    </div>
  );
}
