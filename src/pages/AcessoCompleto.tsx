import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { WaitlistCard } from "@/components/WaitlistCard";
import { useHasFullPlatformAccess } from "@/hooks/useHasFullPlatformAccess";

// ─── /acesso-completo ────────────────────────────────────────────────────────
// Página do "Acesso completo à plataforma" — destino do banner fixo no topo da
// área de membros. Explica que a aluna libera TODOS os conteúdos (atuais e
// futuros) por 12 meses.
//
// SEM CHECKOUT (2026-08-19): as inscrições estão fechadas. No lugar do checkout
// Eduzz embutido, a aluna entra na LISTA DE ESPERA (`waitlist_signups`), que o
// admin acompanha na aba "Lista de Espera".
// =============================================================================

const BENEFITS = [
  { icon: "video_library", text: "Todos os cursos que já existem na plataforma" },
  { icon: "auto_awesome", text: "Todos os cursos novos dos próximos 12 meses" },
  { icon: "calendar_month", text: "12 meses de acesso completo" },
  { icon: "notifications_active", text: "Você é avisada em primeira mão quando abrir" },
];

export default function AcessoCompleto() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasAccess = useHasFullPlatformAccess();

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      {/* Topbar: voltar */}
      <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="caution-tape h-1.5 w-full" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="size-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Voltar"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </button>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground line-clamp-1">
            Lista de espera · Acesso completo
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 md:pt-10 pb-28 lg:pb-10">
        {/* Já tem acesso completo → não mostra checkout */}
        {hasAccess === true && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-[hsl(var(--success)/0.12)] border border-[hsl(var(--success)/0.35)] text-[hsl(var(--success))] rounded-2xl p-4 flex items-center gap-3"
          >
            <span className="material-symbols-outlined">check_circle</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Você já tem o acesso completo à plataforma</p>
              <p className="text-xs opacity-80">Todos os cursos estão liberados pra você.</p>
            </div>
            <button
              onClick={() => navigate("/biblioteca")}
              className="shrink-0 px-4 py-2 rounded-xl bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs font-black uppercase tracking-widest hover:brightness-110 transition"
            >
              Meus cursos
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* EXPLICAÇÃO (esquerda) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-7"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              ⏳ Inscrições fechadas · Lista de espera aberta
            </p>
            <h1
              className="mt-2 text-2xl sm:text-3xl md:text-4xl font-black leading-[1.05] tracking-tight"
              style={{ textWrap: "balance" }}
            >
              Acesso completo à plataforma
            </h1>
            <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
              O acesso completo libera <strong className="text-foreground">todos os conteúdos
              da plataforma — os que já existem e todos os que forem lançados</strong> — por um
              período de <strong className="text-foreground">12 meses</strong>. As inscrições
              estão fechadas no momento: entre na lista de espera e você é avisada assim que abrir.
            </p>

            <ul className="mt-6 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b.text} className="flex items-start gap-3">
                  <span className="mt-0.5 size-8 shrink-0 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-lg">{b.icon}</span>
                  </span>
                  <span className="text-sm md:text-base text-foreground/90 leading-snug pt-1.5">
                    {b.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* Aviso do e-mail — é por ele que o aviso da lista chega */}
            <div className="mt-6 rounded-2xl bg-card border border-border p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary">alternate_email</span>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                O aviso vai chegar{" "}
                {user?.email ? (
                  <>no e-mail <strong className="text-foreground">{user.email}</strong> (o desta conta)</>
                ) : (
                  <>no <strong className="text-foreground">e-mail da sua conta</strong></>
                )}
                , então fique de olho na caixa de entrada.
              </p>
            </div>
          </motion.div>

          {/* LISTA DE ESPERA (direita, sticky no desktop) */}
          {hasAccess !== true && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="lg:col-span-5 lg:sticky lg:top-24"
            >
              <WaitlistCard productId={null} title="o acesso completo à plataforma" source="banner" />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
