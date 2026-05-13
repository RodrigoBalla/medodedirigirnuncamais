import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SupportChat } from "@/components/SupportChat";

// ─── /login ─────────────────────────────────────────────────────────────────
// Tela ÚNICA de login. O "primeiro acesso" antigo (cadastro manual com
// verificação de matrícula) foi removido porque agora o fluxo é 100%
// automático via webhook Eduzz:
//
//   1. Aluna compra
//   2. Webhook cria conta automaticamente
//   3. Brevo manda email com link único pra /primeiro-acesso?token=...
//   4. Aluna clica → cria senha → entra na biblioteca
//
// Quem chega aqui SÓ pode ser aluna existente que quer relogar. Se digitou
// errado a senha, o Supabase já dá erro claro. Se esqueceu, o caminho é
// "Esqueci a senha" do próprio Supabase Auth (futuro: botão dedicado).
// =============================================================================

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const confirmed = searchParams.get("confirmed");
  const blocked = searchParams.get("blocked");

  // Se já logada, redireciona pro app
  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  // Mensagem pós-confirmação de email (legado, raramente usado)
  useEffect(() => {
    if (confirmed === "true") {
      setSuccess("Deu tudo certo! Agora faça o seu login e bons estudos!");
      searchParams.delete("confirmed");
      setSearchParams(searchParams);
    }
  }, [confirmed, searchParams, setSearchParams]);

  // Mensagem quando admin bloqueou e a aluna foi deslogada
  useEffect(() => {
    if (blocked === "true") {
      setError("🚫 Seu acesso foi bloqueado administrativamente. Entre em contato com o suporte.");
      searchParams.delete("blocked");
      setSearchParams(searchParams);
    }
  }, [blocked, searchParams, setSearchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col lg:flex-row relative overflow-hidden bg-[hsl(var(--blue-900))]">
      {/* ── HERO ─────────────────────────────────────────────────────────
          Desktop: coluna esquerda (lg:flex-1, h tela inteira).
          Mobile: bloco no topo. */}
      <aside className="relative flex flex-col lg:overflow-hidden lg:flex-1 lg:border-r border-white/5 lg:min-h-screen">
        {/* MOBILE: imagem hero 1:1 com Carla centralizada. */}
        <div className="lg:hidden relative w-full h-[28vh] min-h-[200px] max-h-[260px] overflow-hidden">
          <img
            src="/hero/area-de-membros-mobile.jpg"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[hsl(var(--blue-900))] z-10" />
          <div className="absolute top-4 left-5 z-20 flex items-center gap-2.5">
            <div className="size-9 bg-primary/30 rounded-lg flex items-center justify-center border border-primary/40 backdrop-blur-md">
              <span className="material-symbols-outlined text-primary text-base filled-icon">directions_car</span>
            </div>
            <div>
              <p className="text-white font-black text-xs leading-tight drop-shadow-lg">Medo de Dirigir</p>
              <p className="text-primary font-black text-xs leading-tight drop-shadow-lg">Nunca Mais</p>
            </div>
          </div>
        </div>

        <div className="lg:hidden px-6 pt-3 pb-3 bg-[hsl(var(--blue-900))] text-center">
          <p className="inline-block px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[9px] font-black uppercase tracking-widest text-primary mb-2">
            🛞 Sua área de membros
          </p>
          <h1 className="text-white font-black text-xl sm:text-2xl leading-[1.05] tracking-tight">
            O volante <span className="text-primary">agora é seu.</span>
          </h1>
        </div>

        {/* DESKTOP: layout completo com imagem cobrindo a coluna */}
        <div className="hidden lg:block absolute inset-0">
          <img
            src="/hero/area-de-membros-desktop.jpg"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--blue-900))]/95 via-[hsl(var(--blue-900))]/70 to-[hsl(var(--blue-900))]/30 z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,214,10,0.12),transparent_55%)] z-10" />
          <div className="caution-tape absolute top-0 left-0 right-0 h-2 z-30" aria-hidden />
          <div className="caution-tape absolute bottom-0 left-0 right-0 h-2 z-30" aria-hidden />
          <div className="relative z-20 flex flex-col justify-between p-10 xl:p-16 w-full h-full">
            <div className="flex items-center gap-3">
              <div className="size-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                <span className="material-symbols-outlined text-primary text-2xl filled-icon">directions_car</span>
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">Medo de Dirigir</p>
                <p className="text-primary font-black text-sm leading-tight">Nunca Mais</p>
              </div>
            </div>
            <div className="max-w-lg">
              <p className="inline-block px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-black uppercase tracking-widest text-primary mb-4">
                🛞 Sua área de membros
              </p>
              <h1 className="text-white font-black text-4xl xl:text-6xl leading-[1.02] tracking-tight mb-5">
                O volante<br /><span className="text-primary">agora é seu.</span>
              </h1>
              <p className="text-white/70 text-base leading-relaxed mb-8">
                Sua jornada continua aqui. Aulas no seu ritmo, comunidade só de
                mulheres e a Carla a um clique de distância.
              </p>
              <ul className="space-y-3">
                {[
                  { icon: "play_circle", text: "Aulas em vídeo, no seu tempo" },
                  { icon: "groups", text: "Comunidade pra trocar com outras alunas" },
                  { icon: "support_agent", text: "Carla no WhatsApp quando travar" },
                  { icon: "emoji_events", text: "Conquistas e recompensas pra te manter no caminho" },
                ].map((b) => (
                  <li key={b.icon} className="flex items-center gap-3 text-white/85 text-sm">
                    <span className="material-symbols-outlined text-primary filled-icon text-lg shrink-0">
                      {b.icon}
                    </span>
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-white/40 text-xs">
              © 2026 Medo de Dirigir Nunca Mais. Feito pra você dirigir sem medo.
            </p>
          </div>
        </div>
      </aside>

      {/* ── FORMULÁRIO DE LOGIN ───────────────────────────────────────── */}
      <main className="flex-1 lg:flex-none lg:w-[480px] xl:w-[540px] flex items-start lg:items-center justify-center px-6 pt-3 pb-4 sm:p-8 lg:p-10 relative bg-[hsl(var(--blue-900))]">
        <div className="relative z-10 w-full max-w-md lg:max-w-none lg:bg-transparent lg:p-0">
          <div className="text-center lg:text-left mb-3 lg:mb-8">
            <h2 className="text-lg lg:text-3xl font-black text-white tracking-tight">
              Bem-vinda de volta
            </h2>
            <p className="text-white/50 text-xs lg:text-sm mt-0.5 lg:mt-2">
              Entre na sua conta pra continuar
            </p>
          </div>

          {/* Erros e mensagens de sucesso */}
          {error && (
            <div className="bg-destructive/15 border border-destructive/30 rounded-xl px-4 py-3 text-red-300 text-sm font-medium mb-4">
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 text-green-300 text-sm font-medium mb-4">
              ✅ {success}
            </div>
          )}

          {/* Form de login */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Sua senha"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? "Aguarde..." : "COMEÇAR A DIRIGIR 🛞"}
            </button>
          </form>

          {/* Rodapé informativo — pra aluna nova que chegou aqui sem saber o caminho */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-white/40 text-xs leading-relaxed text-center lg:text-left">
              Acabou de comprar e ainda não tem senha?<br />
              Olhe o e-mail que enviamos com o link de primeiro acesso (caixa de entrada e spam).
              Se não chegou, fale com a gente em{" "}
              <a
                href="https://wa.me/5521993685289"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold hover:underline"
              >
                wa.me/5521993685289
              </a>.
            </p>
          </div>
        </div>
      </main>

      {/* Botão flutuante de suporte WhatsApp + chat guiado */}
      <SupportChat />
    </div>
  );
};

export default Auth;
