import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { toast } from "sonner";

// ─── CashbackCard ────────────────────────────────────────────────────────────
// Card mostrando "Suas moedas valem R$ X". Permite converter um múltiplo
// do mínimo (ex: 100 moedas = R$ 1) em cupom de desconto.
//
// Cupom sai como código MDDNM-XXXXXX que o aluno usa no checkout do próximo
// curso. Configurações vêm de cashback_config (admin edita).
// =============================================================================

interface Config {
  coins_per_brl: number;
  max_discount_pct: number;
  validity_days: number;
  min_coins_to_convert: number;
}

interface Coupon {
  code: string;
  value_brl: number;
  used: boolean;
  expires_at: string;
  created_at: string;
}

export function CashbackCard() {
  const { user } = useAuth();
  const { coins } = useUserProgress();
  const [config, setConfig] = useState<Config | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [converting, setConverting] = useState(false);
  const [amount, setAmount] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [c, k] = await Promise.all([
      supabase.from("cashback_config").select("*").eq("id", 1).maybeSingle(),
      supabase.from("discount_coupons").select("code, value_brl, used, expires_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    if (c.data) {
      setConfig(c.data as Config);
      setAmount(c.data.min_coins_to_convert);
    }
    if (k.data) setCoupons(k.data as Coupon[]);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!config) return null;

  const valueBrl = (amount / config.coins_per_brl).toFixed(2);
  const canConvert = coins >= amount && amount >= config.min_coins_to_convert;
  const totalCashbackBrl = (coins / config.coins_per_brl).toFixed(2);

  async function convert() {
    if (!canConvert || converting) return;
    setConverting(true);
    try {
      const { data, error } = await supabase.rpc("convert_coins_to_coupon", { p_coins_amount: amount });
      if (error) throw error;
      const row = (data as Array<{ code: string; value_brl: number }>)?.[0];
      if (row) {
        toast.success(`💸 Cupom criado: ${row.code}`, {
          description: `R$ ${Number(row.value_brl).toFixed(2)} de desconto · válido por ${config?.validity_days ?? 90} dias`,
          duration: 8000,
        });
        // Copia pra clipboard
        try { await navigator.clipboard.writeText(row.code); } catch {}
        await loadData();
      }
    } catch (err: any) {
      console.warn("[cashback] convert error:", err);
      toast.error("Não foi possível converter", { description: err?.message ?? "Tente novamente." });
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">savings</span>
          Cashback
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {config.coins_per_brl} 🪙 = R$ 1
        </span>
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-xl p-4 mb-4">
        <p className="text-xs text-muted-foreground mb-1">Suas moedas valem</p>
        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
          R$ {totalCashbackBrl}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Use como desconto no próximo curso (até {config.max_discount_pct}% do valor)
        </p>
      </div>

      <div className="space-y-2 mb-3">
        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Converter quantas moedas em cupom?
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={config.min_coins_to_convert}
            step={config.min_coins_to_convert}
            max={coins}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono"
          />
          <span className="text-sm font-bold text-foreground whitespace-nowrap">= R$ {valueBrl}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Mínimo: {config.min_coins_to_convert} moedas (R$ {(config.min_coins_to_convert / config.coins_per_brl).toFixed(2)})
        </p>
      </div>

      <button
        onClick={convert}
        disabled={!canConvert || converting}
        className="w-full px-4 py-2.5 text-sm font-black uppercase tracking-widest bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {converting ? "Gerando…" : "Converter em cupom"}
      </button>

      {coupons.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Seus cupons
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {coupons.map((c) => (
              <div
                key={c.code}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                  c.used
                    ? "border-border bg-muted/30 opacity-60"
                    : "border-amber-500/30 bg-amber-500/5"
                }`}
              >
                <div>
                  <p className="font-mono font-bold text-foreground">{c.code}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.used ? "Usado" : `Válido até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  R$ {Number(c.value_brl).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
