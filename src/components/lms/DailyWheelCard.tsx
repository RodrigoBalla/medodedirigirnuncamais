import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyWheelSpinModal, type SpinPhase, type SpinResult } from "./DailyWheelSpinModal";
import { playWheelTickSound, playPrizeRevealSound } from "@/lib/sounds";

// ─── DailyWheelCard ──────────────────────────────────────────────────────────
// Roleta diária no /perfil. 1 giro a cada 24h. Sorteia 1 prêmio entre 8.
//
// IMPORTANTE: o estado do giro (phase, result, rotation) vive AQUI no parent,
// pra evitar que remounts do modal abortem a animação de reveal. O modal é
// um componente "burro" que só desenha o que recebe via props.
//
// Fluxo:
//   1. Busca can_spin_daily_wheel() — habilita botão ou mostra countdown
//   2. Click "Girar Agora" → abre modal (phase="idle")
//   3. User clica "Girar Roleta" no modal → onSpin → handleSpin()
//   4. handleSpin: chama RPC, calcula rotação, anima 3.5s, revela
//   5. Atualiza cooldown + toast
// =============================================================================

const SLICE_COUNT = 8;
const DEG_PER_SLICE = 360 / SLICE_COUNT; // 45°
const SPIN_DURATION_MS = 3500;
const REVEAL_DELAY_MS = 700;

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
  const [now, setNow] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(false);

  // Estado do giro vive AQUI pra sobreviver a remounts do modal
  const [phase, setPhase] = useState<SpinPhase>("idle");
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [rotation, setRotation] = useState(0);

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

  const handleOpenModal = useCallback(() => {
    if (!canSpin) return;
    // Reset defensivo pra garantir que abre em "idle"
    setPhase("idle");
    setSpinResult(null);
    setRotation(0);
    setModalOpen(true);
  }, [canSpin]);

  // ─── handleSpin ──────────────────────────────────────────────────────────
  // Chama RPC, calcula rotação correta pra fatia sorteada, anima e revela.
  const handleSpin = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("spinning");

    try {
      // 1) Chama RPC e busca catálogo em paralelo (catálogo ajuda a saber o
      //    display_order do prêmio sorteado)
      const [{ data: spinData, error: spinErr }, { data: prizesData }] = await Promise.all([
        supabase.rpc("spin_daily_wheel"),
        supabase
          .from("daily_wheel_prizes")
          .select("id, display_order")
          .eq("active", true)
          .order("display_order"),
      ]);

      if (spinErr) throw spinErr;
      const row = (spinData as Array<SpinResult>)?.[0];
      if (!row) throw new Error("Sem resultado da RPC");

      // 2) Calcula índice da fatia e ângulo final
      const prizes = (prizesData ?? []) as Array<{ id: string; display_order: number }>;
      const prizeIndex = prizes.findIndex((p) => p.id === row.prize_id);
      const targetSlice = prizeIndex >= 0 ? prizeIndex : 0;

      // O conic-gradient começa em -22.5deg, então a fatia 0 fica centrada
      // no topo. Pra alinhar a fatia `i` com o pointer (topo), o disco deve
      // girar -i * 45° (mod 360). Adicionamos 5 voltas pra dar drama.
      const finalRotation = 360 * 5 - targetSlice * DEG_PER_SLICE;

      setRotation(finalRotation);
      setSpinResult(row);

      // 3) Espera a animação do disco terminar, com sons "tic-tic" desacelerando
      const tickTimings = [0, 150, 320, 510, 720, 950, 1200, 1480, 1780, 2100, 2440, 2800, 3170];
      const tickTimers: number[] = [];
      tickTimings.forEach((ms) => {
        if (ms < SPIN_DURATION_MS) {
          tickTimers.push(window.setTimeout(() => playWheelTickSound(), ms));
        }
      });
      await new Promise((r) => setTimeout(r, SPIN_DURATION_MS));
      tickTimers.forEach(clearTimeout);

      // 4) Mostra cadeado abrindo
      setPhase("revealing");
      await new Promise((r) => setTimeout(r, REVEAL_DELAY_MS));

      // 5) Reveal final — banner + confetti + "Parabéns!" + fanfarra
      setPhase("revealed");
      playPrizeRevealSound();

      // Toast no card (o banner do modal mostra detalhes)
      const valueLabel =
        row.prize_type === "coins" ? `+${row.prize_value} 🪙`
        : row.prize_type === "xp_boost" ? `+${row.prize_value}h ⚡`
        : row.prize_type === "extra_life" ? "+1 ❤️"
        : "+1 🛡️";
      toast.success(`🎉 ${row.prize_label}!`, {
        description: valueLabel + " · válido por 30 dias",
        duration: 5000,
      });

      // Atualiza cooldown
      await loadStatus();
    } catch (err) {
      console.warn("[wheel] spin error:", err);
      const msg = (err as { message?: string })?.message ?? "Erro desconhecido";
      toast.error("Não foi possível girar a roleta", { description: msg });
      setPhase("idle");
      setSpinResult(null);
      setRotation(0);
    }
  }, [phase, loadStatus]);

  // ─── handleClose ─────────────────────────────────────────────────────────
  // Não fecha durante a animação. Após fechar, reseta o estado com um leve
  // delay pra não causar flicker enquanto o modal sai.
  const handleClose = useCallback(() => {
    if (phase === "spinning" || phase === "revealing") return;
    setModalOpen(false);
    window.setTimeout(() => {
      setPhase("idle");
      setSpinResult(null);
      setRotation(0);
    }, 400);
  }, [phase]);

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
        {/* Disco do card (estático) — maior em desktop pra ficar imponente */}
        <div className="relative shrink-0">
          <motion.div
            animate={canSpin ? { rotate: [0, 360] } : { rotate: 0 }}
            transition={canSpin ? { duration: 12, repeat: Infinity, ease: "linear" } : { duration: 0 }}
            className="size-28 md:size-44 rounded-full border-4 border-primary shadow-xl shadow-primary/30"
            style={{
              background: "conic-gradient(from -22.5deg, #FFD60A 0 45deg, #0B1A38 45deg 90deg, #FFD60A 90deg 135deg, #0B1A38 135deg 180deg, #FFD60A 180deg 225deg, #0B1A38 225deg 270deg, #FFD60A 270deg 315deg, #0B1A38 315deg 360deg)",
            }}
          />
          {/* Pointer pulsa quando pode girar */}
          <motion.div
            animate={canSpin ? { y: [0, 3, 0] } : { y: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-1 left-1/2 -translate-x-1/2 size-0 border-l-[8px] md:border-l-[12px] border-r-[8px] md:border-r-[12px] border-t-[12px] md:border-t-[16px] border-l-transparent border-r-transparent border-t-primary drop-shadow"
          />
          {/* Hub central — maior em desktop */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-10 md:size-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined filled-icon text-xl md:text-2xl">redeem</span>
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

      {/* Modal full-screen com animação cinematográfica + cadeados + reveal.
          Estado do giro vive aqui no card pra não ser perdido em remounts. */}
      <DailyWheelSpinModal
        open={modalOpen}
        phase={phase}
        result={spinResult}
        rotation={rotation}
        onSpin={handleSpin}
        onClose={handleClose}
      />
    </div>
  );
}
