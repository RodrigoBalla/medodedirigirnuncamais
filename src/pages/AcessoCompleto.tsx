import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { EduzzCheckoutEmbed } from "@/components/lms/EduzzCheckoutEmbed";
import {
  useHasFullPlatformAccess,
  FULL_PLATFORM_CHECKOUT_ID,
} from "@/hooks/useHasFullPlatformAccess";

// ─── /acesso-completo ────────────────────────────────────────────────────────
// Página da OFERTA ESPECIAL "Acesso completo à plataforma" — destino do banner
// fixo no topo da área de membros. Explica que a aluna libera TODOS os
// conteúdos (atuais e futuros) por 12 meses, com o checkout Eduzz EMBUTIDO
// inline na própria página (sem sair). Após a compra, o webhook libera o grupo
// "Acesso completo a plataforma" automaticamente.
// =============================================================================

const BENEFITS = [
  { icon: "video_library", text: "Todos os cursos que já existem na plataforma" },
  { icon: "auto_awesome", text: "Todos os cursos novos dos próximos 12 meses — sem pagar de novo" },
  { icon: "bolt", text: "Acesso liberado na hora após o pagamento" },
  { icon: "calendar_month", text: "12 meses de acesso completo" },
  { icon: "verified_user", text: "Checkout seguro Eduzz · 7 dias de garantia" },
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
            Oferta especial · Acesso completo
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
              🔓 Oferta especial · Oportunidade única
            </p>
            <h1
              className="mt-2 text-2xl sm:text-3xl md:text-4xl font-black leading-[1.05] tracking-tight"
              style={{ textWrap: "balance" }}
            >
              Libere o acesso completo à plataforma
            </h1>
            <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
              Com essa oferta você libera <strong className="text-foreground">todos os conteúdos
              da plataforma — os que já existem e todos os que forem lançados</strong> — por um
              período de <strong className="text-foreground">12 meses</strong>. É tudo em um só
              lugar, no seu ritmo, sem precisar comprar curso por curso.
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

            {/* Aviso do e-mail — crucial pra liberar na conta certa */}
            <div className="mt-6 rounded-2xl bg-card border border-border p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary">alternate_email</span>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Use{" "}
                {user?.email ? (
                  <>o e-mail <strong className="text-foreground">{user.email}</strong> (o desta conta)</>
                ) : (
                  <>o <strong className="text-foreground">mesmo e-mail da sua conta</strong></>
                )}{" "}
                no checkout pra o acesso ser liberado <strong className="text-foreground">na sua conta atual</strong>, na hora.
              </p>
            </div>
          </motion.div>

          {/* CHECKOUT EMBUTIDO (direita, sticky no desktop) */}
          {hasAccess !== true && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="lg:col-span-5 lg:sticky lg:top-24"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-lg">shopping_bag</span>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-foreground">
                  Finalize aqui mesmo
                </p>
              </div>
              <EduzzCheckoutEmbed contentId={FULL_PLATFORM_CHECKOUT_ID} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
