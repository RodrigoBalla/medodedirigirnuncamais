import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyWheelSpinModal } from "./DailyWheelSpinModal";

// ─── DailyWheelCard ──────────────────────────────────────────────────────────
// Roleta diária no /perfil. 1 giro a cada 24h. Sorteia 1 prêmio entre 8
// (moedas / streak freeze / xp boost / vida extra) com pesos calibrados
// pra ~70%+ ganhar moedas e SEMPRE ganhar algo. Prêmios expiram em 30 dias.
//
// Fluxo:
//   1. Busca can_spin_daily_wheel() — habilita botão ou mostra countdown
//   2. Click "Girar" → spin_daily_wheel() (RPC) → animação + toast com prêmio
//   3. Re-busca cooldown e mostra "Volta em XX:XX:XX"
// =============================================================================

interface SpinResult {
  prize_id: string;
  prize_code: string;
  prize_label: string;
  prize_type: "coins" | "streak_freeze" | "xp_boost" | "extra_life";
  prize_value: number;
  prize_icon: string;
  rarity: "common" | "rare" | "epic";
  expires_at: string;
  total_balance: number;
}

const RARITY_BG: Record<string, string> = {
  common: "from-slate-500/20 to-slate-700/20 border-slate-500/40",
  rare:   "from-blue-500/25 to-purple-600/25 border-blue-500/50",
  epic:   "from-amber-500/30 to-yellow-600/30 border-amber-500/60",
};

function formatCountdown(targetMs: number): string {
  const diff = Math.max(0, targetMs - Date.now());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DailyWheelCard() {
  const { user } = useAuth();
  const [canSpin, setCanSpin] = useState(false);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("can_spin_daily_wheel");
      if (error) throw error;
      const row = (data as Array<{ can_spin: boolean; next_available_at: string | null }>)?.[0];
      if (row) {
        setCanSpin(row.can_spin);
        setNextAt(row.next_available_at ? new Date(row.next_available_at).getTime() : null);
      }
    } catch (err) {
      console.warn("[wheel] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Tick a cada 1s pra atualizar o countdown
  useEffect(() => {
    if (canSpin || !nextAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [canSpin, nextAt]);

  // Quando countdown chega a zero, refresca o status
  useEffect(() => {
    if (canSpin || !nextAt) return;
    if (nextAt - now <= 0) loadStatus();
  }, [now, nextAt, canSpin, loadStatus]);

  // Abre modal full-screen com a animação cinematográfica + cadeados.
  // O modal cuida do RPC e da animação; aqui só recebemos o resultado pra
  // atualizar o cooldown e mostrar o último prêmio no card.
  const handleOpenModal = useCallback(() => {
    if (!canSpin) return;
    setLastResult(null);
    setModalOpen(true);
  }, [canSpin]);

  const handleSpinComplete = useCallback(async (result: SpinResult) => {
    setLastResult(result);
    const valueLabel =
      result.prize_type === "coins" ? `+${result.prize_value} 🪙`
      : result.prize_type === "xp_boost" ? `+${result.prize_value}h ⚡`
      : result.prize_type === "extra_life" ? "+1 ❤️"
      : "+1 🛡️";
    toast.success(`🎉 ${result.prize_label}!`, {
      description: valueLabel + " · válido por 30 dias",
      duration: 5000,
    });
    await loadStatus();
  }, [loadStatus]);

  if (loading) {
    return (
      <div className="bg-card rounded-[32px] border border-border p-6 mb-6 shadow-sm flex items-center justify-center min-h-[180px]">
        <span className="material-symbols-outlined animate-spin mr-2 text-muted-foreground">progress_activity</span>
        <span className="text-sm text-muted-foreground">Carregando roleta…</span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-[32px] border border-border p-5 md:p-6 mb-6 shadow-sm overflow-hidden relative">
      {/* Brilho decorativo de fundo */}
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-4">
        {/* Disco animado */}
        <div className="relative shrink-0">
          <motion.div
            animate={spinning ? { rotate: 360 * 6 } : { rotate: 0 }}
            transition={{ duration: 1.6, ease: [0.17, 0.67, 0.25, 1.05] }}
            className="size-28 md:size-32 rounded-full border-4 border-primary shadow-xl shadow-primary/30"
            style={{
              background: "conic-gradient(from -22.5deg, #FFD60A 0 45deg, #0B1A38 45deg 90deg, #FFD60A 90deg 135deg, #0B1A38 135deg 180deg, #FFD60A 180deg 225deg, #0B1A38 225deg 270deg, #FFD60A 270deg 315deg, #0B1A38 315deg 360deg)",
            }}
          />
          {/* Pointer */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary drop-shadow" />
          {/* Hub central */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined filled-icon text-xl">redeem</span>
            </div>
          </div>
        </div>

        {/* Info + Botão */}
        <div className="flex-1 flex flex-col justify-center text-center md:text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">
            Roleta da Sorte
          </p>
          <h3 className="font-black text-lg text-foreground mb-1 leading-tight">
            Seu giro do dia
          </h3>
          <p className="text-xs text-muted-foreground mb-3 leading-snug">
            1 prêmio a cada 24h · pode dar moedas, vidas, escudo de streak ou
            até 2× XP. Tudo expira em 30 dias.
          </p>

          {canSpin ? (
            <button
              onClick={handleOpenModal}
              className="self-center md:self-start px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-yellow-500 text-primary-foreground font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-[1.03] active:scale-95 transition-transform"
            >
              🎰 Girar Agora
            </button>
          ) : (
            <div className="self-center md:self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/40 border border-border">
              <span className="material-symbols-outlined text-base text-muted-foreground">timer</span>
              <span className="text-xs font-bold text-muted-foreground">
                Volta em <span className="text-foreground font-mono">{nextAt ? formatCountdown(nextAt) : "--:--:--"}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Banner do prêmio recém-ganho */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={`relative z-10 mt-4 rounded-2xl border-2 p-4 bg-gradient-to-br ${RARITY_BG[lastResult.rarity] ?? RARITY_BG.common} flex items-center gap-3`}
          >
            <div className="size-12 rounded-xl bg-background/40 border border-white/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined filled-icon text-2xl text-primary">{lastResult.prize_icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {lastResult.rarity === "epic" ? "🏆 Épico" : lastResult.rarity === "rare" ? "💎 Raro" : "✨ Comum"}
              </p>
              <p className="font-black text-base text-foreground leading-tight">{lastResult.prize_label}</p>
              <p className="text-[11px] text-muted-foreground">
                Válido até {new Date(lastResult.expires_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal full-screen com animação cinematográfica + cadeados + reveal */}
      <DailyWheelSpinModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSpinComplete={handleSpinComplete}
      />
    </div>
  );
}
