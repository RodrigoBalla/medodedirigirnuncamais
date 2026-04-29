import { motion, AnimatePresence } from "framer-motion";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { playCoinSound, playWrongSound } from "@/lib/sounds";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SHOP_ITEMS = [
  {
    id: "life",
    name: "Refil de Vida",
    desc: "Recupere +1 ❤️ para continuar seus desafios.",
    price: 50,
    icon: "favorite",
    color: "text-red-500",
    gradient: "from-red-500/20 to-red-500/5",
  },
  {
    id: "full_lives",
    name: "Coração de Ferro",
    desc: "Restaura todas as suas 5 vidas instantaneamente.",
    price: 200,
    icon: "bolt",
    color: "text-yellow-500",
    gradient: "from-yellow-500/20 to-yellow-500/5",
  },
  {
    id: "streak_freeze",
    name: "Escudo de Ofensiva",
    desc: "Protege seu foguinho 🔥 se você faltar um dia.",
    price: 300,
    icon: "shield",
    color: "text-blue-500",
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    id: "xp_boost",
    name: "Turbo XP (2h)",
    desc: "Ganhe o dobro de XP em todas as atividades.",
    price: 150,
    icon: "rocket_launch",
    color: "text-purple-500",
    gradient: "from-purple-500/20 to-purple-500/5",
  },
];

export function ShopModal({ isOpen, onClose }: Props) {
  const { coins, buyItem, xpBoostExpiresAt } = useUserProgress();

  const handleBuy = async (id: any) => {
    try {
      await buyItem(id);
      playCoinSound();
    } catch (e) {
      playWrongSound();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-card border border-border rounded-[32px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-transparent p-8 pb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic">Loja de Itens</h2>
              <button 
                onClick={onClose}
                className="size-10 rounded-full hover:bg-accent flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-accent px-4 py-1.5 rounded-full border border-border flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500 filled-icon text-sm">database</span>
                <span className="text-sm font-black">{coins} moedas</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium italic">Use suas moedas com sabedoria, motorista!</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {SHOP_ITEMS.map((item) => {
              const isXpBoostActive = item.id === "xp_boost" && xpBoostExpiresAt && new Date(xpBoostExpiresAt) > new Date();
              
              return (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleBuy(item.id as any)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border border-border bg-gradient-to-br ${item.gradient} text-left transition-all hover:border-primary/30 group ${isXpBoostActive ? 'opacity-50 grayscale' : ''}`}
                  disabled={isXpBoostActive}
                >
                  <div className={`size-14 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm group-hover:shadow-md transition-all`}>
                    <span className={`material-symbols-outlined text-3xl filled-icon ${item.color}`}>
                      {item.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm uppercase tracking-tight">
                      {item.name} {isXpBoostActive && "(ATIVO)"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.desc}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-black text-xs shadow-lg shadow-primary/20">
                      {item.price}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-6 pt-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
              Novos itens toda semana na atualização do LMS
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
