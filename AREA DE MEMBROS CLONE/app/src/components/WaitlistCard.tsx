import { motion } from "framer-motion";
import { toast } from "sonner";
import { useWaitlist, type WaitlistSource } from "@/hooks/useWaitlist";

// ─── WaitlistCard ────────────────────────────────────────────────────────────
// Substitui o checkout na área de membros. Em vez de comprar, a aluna entra na
// LISTA DE ESPERA e o admin acompanha na aba "Lista de Espera".
//
// productId = null → interesse na plataforma completa (banner / acesso expirado).
// =============================================================================

interface Props {
  productId: string | null;
  /** Nome do que ela está pedindo — usado só no texto. */
  title?: string;
  source: WaitlistSource;
  /** "card" = bloco completo (páginas). "inline" = só o botão (barra fixa mobile). */
  variant?: "card" | "inline";
}

export function WaitlistCard({ productId, title, source, variant = "card" }: Props) {
  const { joined, saving, join } = useWaitlist(productId);

  async function handleJoin() {
    const ok = await join(source);
    if (ok) toast.success("Pronto! Você está na lista de espera. 🎉");
    else toast.error("Não deu pra te inscrever agora. Tenta de novo?");
  }

  const isIn = joined === true;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleJoin}
        disabled={saving || isIn}
        className={`w-full flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm px-4 py-3.5 rounded-xl transition active:scale-[0.99] ${
          isIn
            ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/30"
            : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
        } disabled:opacity-80`}
      >
        <span className="material-symbols-outlined text-base">{isIn ? "check_circle" : "notifications_active"}</span>
        {isIn ? "Você está na lista" : "Entrar na lista de espera"}
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary text-lg">hourglass_top</span>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-foreground">
          {isIn ? "Você está na lista" : "Lista de espera"}
        </p>
      </div>

      {isIn ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Sua vaga na fila está garantida{title ? <> para <strong className="text-foreground">{title}</strong></> : null}.
            Assim que abrirmos as inscrições, você é uma das primeiras a saber.
          </p>
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-3 text-sm font-bold text-[hsl(var(--success))]">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Inscrição confirmada
          </div>
        </motion.div>
      ) : (
        <>
          <ul className="space-y-2 mb-5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">notifications_active</span>
              Você é avisada assim que abrir
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">workspace_premium</span>
              Prioridade pra quem entrou antes
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">favorite</span>
              Sem compromisso, é só avisar seu interesse
            </li>
          </ul>

          <button
            type="button"
            onClick={handleJoin}
            disabled={saving || joined === null}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-base px-4 py-4 rounded-xl hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-primary/20 disabled:opacity-60"
          >
            <span className="material-symbols-outlined">{saving ? "progress_activity" : "notifications_active"}</span>
            {saving ? "Inscrevendo..." : "Entrar na lista de espera"}
          </button>

          <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">
            As inscrições estão <strong className="text-foreground">temporariamente fechadas</strong>. Entre na
            lista pra ser avisada em primeira mão.
          </p>
        </>
      )}
    </div>
  );
}
