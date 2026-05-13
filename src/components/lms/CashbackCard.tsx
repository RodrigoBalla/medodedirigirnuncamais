import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDisplayName } from "@/hooks/useDisplayName";
import { toast } from "sonner";

// ─── CashbackCard ────────────────────────────────────────────────────────────
// Card mostrando "Suas moedas valem R$ X". Permite converter um múltiplo
// do mínimo (ex: 100 moedas = R$ 1) em cupom de desconto.
//
// Cupom sai como código MDDNM-XXXXXX, mas como a API pública da Eduzz NÃO
// permite criar cupom programaticamente, o fluxo é semi-automatizado:
//   1. Aluna gera o código no app (debita moedas + cria registro local)
//   2. Aparece um botão "Ativar via WhatsApp" que abre conversa direto
//      no número do Balla com mensagem pré-pronta contendo o código
//   3. Balla recebe a mensagem, cria o cupom REAL na Eduzz com o mesmo
//      código, e confirma pela conversa
//   4. Aluna usa no checkout
//
// Configurações vêm de cashback_config (admin edita).
// =============================================================================

// Número da equipe pra ativação do cupom (sem +, sem espaços, sem traços)
const WHATSAPP_ATIVACAO = "5521993685289";

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
  const displayName = useDisplayName("");
  const [config, setConfig] = useState<Config | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [converting, setConverting] = useState(false);
  const [amount, setAmount] = useState(0);
  // Saldo VÁLIDO (ignora moedas expiradas) — vem do RPC get_valid_coins_balance
  const [coins, setCoins] = useState(0);
  // Cupom recém gerado nessa sessão — mostra CTA destacado pra ativar via WhatsApp
  const [lastCoupon, setLastCoupon] = useState<{ code: string; value_brl: number } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [c, k, b] = await Promise.all([
      supabase.from("cashback_config").select("*").eq("id", 1).maybeSingle(),
      supabase.from("discount_coupons").select("code, value_brl, used, expires_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.rpc("get_valid_coins_balance"),
    ]);
    if (c.data) {
      setConfig(c.data as Config);
      setAmount(c.data.min_coins_to_convert);
    }
    if (k.data) setCoupons(k.data as Coupon[]);
    if (typeof b.data === "number") setCoins(b.data);
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
        setLastCoupon({ code: row.code, value_brl: Number(row.value_brl) });
        toast.success(`Cupom gerado: ${row.code}`, {
          description: `Agora ative com a equipe pelo WhatsApp pra usar no checkout.`,
          duration: 6000,
        });
        // Copia pra clipboard pra facilitar
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

  /** Monta a URL wa.me com a mensagem pré-pronta da ativação. */
  function buildWhatsAppUrl(code: string, valueBrl: number): string {
    const nome = (displayName || "Aluna").trim();
    const valor = valueBrl.toFixed(2).replace(".", ",");
    const texto =
      `Oi! Sou *${nome}*, do app Medo de Dirigir Nunca Mais.\n\n` +
      `Acabei de gerar um cupom de cashback de *R$ ${valor}* na área de membros.\n` +
      `Código: *${code}*\n\n` +
      `Pode ativar pra eu usar no checkout? 🪙`;
    return `https://wa.me/${WHATSAPP_ATIVACAO}?text=${encodeURIComponent(texto)}`;
  }

  function copyCode(code: string) {
    try {
      navigator.clipboard.writeText(code);
      toast.success("Código copiado", { description: "Cola no campo Cupom do checkout." });
    } catch {
      toast.info("Selecione e copie manualmente o código.");
    }
  }

  // Item 8: progress bar quando saldo < mínimo, e CTA proeminente quando >= mínimo
  const progressToMin = Math.min(100, Math.round((coins / config.min_coins_to_convert) * 100));
  const coinsToNext = Math.max(0, config.min_coins_to_convert - coins);

  return (
    <div className="bg-card border border-border rounded-[32px] p-6 md:p-7 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">savings</span>
          Cashback
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {config.coins_per_brl} 🪙 = R$ 1
        </span>
      </div>

      <div className="bg-gradient-to-br from-amber-500/15 to-yellow-500/5 border border-amber-500/30 rounded-2xl p-4 md:p-5 mb-4">
        <p className="text-xs text-muted-foreground mb-1">Suas moedas valem</p>
        <p className="text-3xl md:text-4xl font-black text-amber-600 dark:text-amber-400">
          R$ {totalCashbackBrl}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Use como desconto no próximo curso
        </p>

        {/* Item 8: Progress até o mínimo OU CTA proeminente quando atinge */}
        {coins < config.min_coins_to_convert ? (
          <div className="mt-3 pt-3 border-t border-amber-500/20">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                Próximo cupom
              </p>
              <p className="text-[10px] font-mono text-muted-foreground">
                {coins}/{config.min_coins_to_convert}
              </p>
            </div>
            <div className="h-2 bg-amber-500/15 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressToMin}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
              Faltam <span className="text-amber-700 dark:text-amber-300 font-black">{coinsToNext} 🪙</span> pro seu próximo cupom de <span className="font-black">R$ {(config.min_coins_to_convert / config.coins_per_brl).toFixed(2)}</span>
            </p>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-amber-500/20">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest mb-1.5">
              ✓ Pronto pra resgatar
            </p>
            <p className="text-[11px] text-muted-foreground">
              Você já tem moedas suficientes pra gerar um cupom abaixo 👇
            </p>
          </div>
        )}
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

      {/* Bloco do cupom recém-gerado — destaque alto com CTA pra ativar via WhatsApp.
          Aparece SÓ depois que a aluna acabou de converter, pra reduzir fricção
          do fluxo "geri → ativei → usei". */}
      {lastCoupon && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="mt-4 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-yellow-500/10 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-amber-500">confirmation_number</span>
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Cupom gerado · Falta 1 passo
            </p>
          </div>

          {/* Código grande e copiável */}
          <button
            type="button"
            onClick={() => copyCode(lastCoupon.code)}
            title="Copiar código"
            className="w-full bg-background border-2 border-dashed border-amber-500/50 rounded-xl px-3 py-3 mb-3 flex items-center justify-between gap-3 hover:bg-accent/30 transition-colors group"
          >
            <span className="font-mono font-black text-lg md:text-xl text-foreground tracking-wider">
              {lastCoupon.code}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
              <span className="material-symbols-outlined text-sm">content_copy</span>
              Copiar
            </span>
          </button>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Esse código <strong>ainda não funciona no checkout</strong>. Clique no botão abaixo, envie a mensagem que já vem pronta no WhatsApp, e a equipe vai ativar pra você em minutos.
          </p>

          {/* CTA WhatsApp — botão principal, verde (cor universal do WhatsApp) */}
          <a
            href={buildWhatsAppUrl(lastCoupon.code, lastCoupon.value_brl)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black px-4 py-3 rounded-xl shadow-lg shadow-[#25D366]/30 uppercase tracking-widest text-xs transition-all"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            Ativar via WhatsApp
          </a>

          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            Valor: R$ {lastCoupon.value_brl.toFixed(2)} · Válido por {config?.validity_days ?? 90} dias
          </p>
        </motion.div>
      )}

      {coupons.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Seus cupons
          </p>
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {coupons.map((c) => {
              const isExpired = !c.used && new Date(c.expires_at).getTime() < Date.now();
              const isLastCoupon = lastCoupon?.code === c.code;
              const isPendingActivation = !c.used && !isExpired && !isLastCoupon;
              return (
                <div
                  key={c.code}
                  className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                    c.used || isExpired
                      ? "border-border bg-muted/30 opacity-60"
                      : "border-amber-500/30 bg-amber-500/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-foreground truncate">{c.code}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.used
                        ? "Usado"
                        : isExpired
                        ? "Expirado"
                        : `Válido até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <span className="font-black text-amber-600 dark:text-amber-400 shrink-0">
                    R$ {Number(c.value_brl).toFixed(2)}
                  </span>
                  {isPendingActivation && (
                    <a
                      href={buildWhatsAppUrl(c.code, Number(c.value_brl))}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ativar via WhatsApp"
                      className="shrink-0 size-7 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] text-white flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">chat</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed">
            💬 Os cupons precisam ser ativados pela equipe pelo WhatsApp antes de funcionar no checkout.
          </p>
        </div>
      )}
    </div>
  );
}
