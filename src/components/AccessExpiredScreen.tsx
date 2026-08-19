import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useWaitlist } from "@/hooks/useWaitlist";

// ─── AccessExpiredScreen ─────────────────────────────────────────────────────
// Tela mostrada pra alunas com profiles.access_status = 'expired'. Bloqueia
// TODA a navegação interna — só permite entrar na lista de espera da renovação
// ou falar com suporte.
//
// Dados, progresso e grupos continuam INTACTOS no banco. Quando o admin
// reativar (status='active'), tudo volta como estava.
//
// SEM CHECKOUT (2026-08-19): a área de membros não vende mais. A renovação
// entrou no mesmo fluxo do resto da plataforma — a aluna entra na LISTA DE
// ESPERA (`waitlist_signups`, product_id NULL = plataforma completa) e o admin
// faz o contato pela aba "Lista de Espera".
// =============================================================================

const WHATSAPP_SUPORTE = "5521993685289";

export function AccessExpiredScreen() {
  const { signOut } = useAuth();
  const displayName = useDisplayName("");
  const { joined, saving, join } = useWaitlist(null);

  const whatsappUrl = (() => {
    const nome = (displayName || "Aluna").trim().split(/\s+/)[0];
    const texto =
      `Oi! Sou *${nome}*, do app Escola de Condutores.\n\n` +
      `Meu acesso ao curso expirou e quero ajuda pra renovar/entender o que aconteceu. 🙏`;
    return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`;
  })();

  async function handleRenovar() {
    if (joined) return;
    const ok = await join("access-expired");
    if (ok) toast.success("Pronto! Você está na lista de espera da renovação. 🎉");
    else toast.error("Não deu pra te inscrever agora. Tenta de novo?");
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-x-clip flex flex-col">
      {/* Fita de advertência no topo — identidade visual */}
      <div className="caution-tape h-1.5 w-full" aria-hidden="true" />

      {/* Botão sair discreto no canto */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={signOut}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          title="Sair"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sair
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Ícone gigante */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className="flex justify-center mb-6"
          >
            <div className="size-24 md:size-28 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="material-symbols-outlined text-amber-500 text-5xl md:text-6xl filled-icon">
                schedule
              </span>
            </div>
          </motion.div>

          {/* Título */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-3"
          >
            <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.18em] text-amber-500 mb-2">
              ⚠️ Matrícula vencida
            </p>
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-black leading-[1.05] tracking-tight"
              style={{ textWrap: "balance" }}
            >
              Seu acesso<br />
              <span className="text-primary">expirou</span>
            </h1>
          </motion.div>

          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center text-sm md:text-base text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto"
          >
            Pra continuar o seu curso, escolha uma das opções abaixo:
          </motion.p>

          {/* CTAs */}
          <div className="space-y-3">
            {/* CTA principal: renovar */}
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRenovar}
              disabled={saving || joined === true}
              className={`w-full rounded-2xl p-5 md:p-6 flex items-center gap-4 shadow-xl transition-all text-left group ${
                joined
                  ? "bg-[hsl(var(--success))]/15 border border-[hsl(var(--success))]/30 text-foreground shadow-black/10"
                  : "bg-primary text-primary-foreground shadow-primary/20 hover:brightness-110"
              } disabled:cursor-default`}
            >
              <div
                className={`size-12 md:size-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  joined ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]" : "bg-black/20"
                }`}
              >
                <span className="material-symbols-outlined text-2xl md:text-3xl">
                  {joined ? "check_circle" : "autorenew"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-80">
                  {joined ? "Inscrição confirmada" : "Recomendado"}
                </p>
                <p className="text-base md:text-lg font-black leading-tight">
                  {joined ? "Você está na lista de espera" : "Entrar na lista de espera"}
                </p>
                <p className="text-xs md:text-sm opacity-80 mt-1 leading-snug">
                  {joined
                    ? "A gente te avisa assim que a renovação abrir."
                    : "As inscrições estão fechadas · avisamos você em primeira mão"}
                </p>
              </div>
              {!joined && (
                <span className="material-symbols-outlined text-2xl md:text-3xl shrink-0 group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              )}
            </motion.button>

            {/* CTA secundário: suporte */}
            <motion.a
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-card border border-border rounded-2xl p-5 md:p-6 flex items-center gap-4 hover:border-primary/40 hover:bg-accent/40 transition-all text-left group"
            >
              <div className="size-12 md:size-14 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#25D366] text-2xl md:text-3xl">chat</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base md:text-lg font-black leading-tight">
                  Falar com suporte
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 leading-snug">
                  Tire dúvidas no WhatsApp · resposta em até algumas horas
                </p>
              </div>
              <span className="material-symbols-outlined text-xl text-muted-foreground shrink-0 group-hover:text-foreground group-hover:translate-x-1 transition-all">
                arrow_outward
              </span>
            </motion.a>
          </div>

          {/* Aviso sobre dados preservados */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="text-center text-[11px] md:text-xs text-muted-foreground/70 mt-8 leading-relaxed max-w-md mx-auto"
          >
            🔒 Seu progresso, moedas e dados foram preservados. Quando você renovar, tudo volta como estava.
          </motion.p>
        </div>
      </div>

    </div>
  );
}
