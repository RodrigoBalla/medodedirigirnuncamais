import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SupportChat } from "@/components/SupportChat";

// O hero antes era 4 vídeos do Pexels em loop infinito (custoso em rede +
// CPU). Trocado por imagem estática (/hero/area-de-membros.jpg) — ~570KB
// 1 request, decodifica numa fração do tempo, sem CPU pra reproduzir.

// URL da página de vendas — servida estaticamente em /sales.html (public/sales.html).
// Quando você plugar checkout final (Eduzz), atualize o link de "IR PARA O CHECKOUT"
// dentro de public/sales.html — não precisa mexer aqui.
const SALES_URL = "/sales.html";

// Frases motivacionais aleatórias mostradas ao aluno que retorna pro login.
// Trocadas a cada visita pra a saudação não cansar.
const MOTIVATIONAL_PHRASES = [
  "Cada quilômetro vale — bora retomar de onde parou.",
  "A confiança ao volante está só a um login de distância.",
  "Não solte o volante agora: você está mais perto da sua meta do que ontem.",
  "Continuar é vencer. Vamos de mais uma fase?",
  "Sua próxima conquista te espera. Bora!",
];

const pickMotivationalPhrase = () =>
  MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];

// Etapas da tab "Cadastrar":
// - email: a pessoa só vê o campo de email + botão "Liberar acesso"
// - enrolled: ela já é aluna (email confere com lista de matriculados) → mostra
//   form completo (nome + senha)
// - not-enrolled: ela ainda não comprou → mostra mensagem + link p/ matrícula
type SignupStep = "email" | "enrolled" | "not-enrolled";

// Estado da saudação "Bem-vindo de volta" mostrada na tab de Login quando
// detectamos que o email digitado no cadastro já tem conta criada.
// IMPORTANTE: por segurança (anti-enumeração), não exibimos nome ou DDD aqui
// — esses dados podem ser puxados *depois* do login, com a sessão autenticada.
interface WelcomeBack {
  phrase: string;
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>("email");
  const [welcomeBack, setWelcomeBack] = useState<WelcomeBack | null>(null);
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [searchParams, setSearchParams] = useSearchParams();
  const confirmed = searchParams.get("confirmed");
  const blocked = searchParams.get("blocked");

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    if (confirmed === "true") {
      setSuccess("Deu tudo certo! Agora faça o seu login e bons estudos!");
      setIsLogin(true);
      searchParams.delete("confirmed");
      setSearchParams(searchParams);
    }
  }, [confirmed, searchParams, setSearchParams]);

  useEffect(() => {
    if (blocked === "true") {
      setError("🚫 Atenção: Seu acesso foi bloqueado administrativamente. Entre em contato com o suporte.");
      searchParams.delete("blocked");
      setSearchParams(searchParams);
    }
  }, [blocked, searchParams, setSearchParams]);

  // Reseta o fluxo de cadastro ao trocar de aba (e limpa a saudação se existir).
  const switchTab = (login: boolean) => {
    setIsLogin(login);
    setError("");
    setSuccess("");
    setSignupStep("email");
    setPassword("");
    setDisplayName("");
    setPhone("");
    if (login === false) setWelcomeBack(null);
  };

  // Volta da etapa enrolled/not-enrolled para o campo de email.
  const goBackToEmail = () => {
    setSignupStep("email");
    setError("");
    setSuccess("");
    setPassword("");
    setDisplayName("");
    setPhone("");
  };

  // Etapa 1 do cadastro:
  // 1. Primeiro checa se o email JÁ TEM conta criada → se tem, redireciona pro
  //    painel de Login com saudação personalizada.
  // 2. Senão, checa a lista de matriculados (check_enrollment) → enrolled ou
  //    not-enrolled.
  const handleCheckEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) throw new Error("Por favor, digite seu email.");
      setEmail(trimmedEmail);

      // Passo 1: já existe conta?
      // RPC retorna apenas { exists } — não expomos nome/DDD via API pública
      // (anti-enumeração de email). A personalização vira pós-login.
      const existing = await supabase.rpc("check_existing_user", { p_email: trimmedEmail });
      if (existing.error) throw existing.error;
      const existingData = existing.data as { exists: boolean } | null;
      if (existingData?.exists) {
        setWelcomeBack({ phrase: pickMotivationalPhrase() });
        setIsLogin(true); // Redireciona pro painel de login
        setPassword("");
        return;
      }

      // Passo 2: está na lista de matriculados?
      const enrollment = await supabase.rpc("check_enrollment", { p_email: trimmedEmail });
      if (enrollment.error) throw enrollment.error;
      setSignupStep(enrollment.data ? "enrolled" : "not-enrolled");
    } catch (err: any) {
      setError(err.message || "Não foi possível verificar seu email. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Login: como antes.
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

  // Etapa final do cadastro: cria a conta no Supabase Auth.
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      // Defesa em profundidade: revalida no banco antes de criar a conta.
      const { data: stillEnrolled } = await supabase.rpc("check_enrollment", { p_email: email });
      if (!stillEnrolled) {
        setSignupStep("not-enrolled");
        return;
      }
      const cleanPhone = phone.replace(/\D/g, "");
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            // Salvo só os dígitos — o trigger handle_new_user lê daqui
            // e popula a coluna profiles.phone.
            phone: cleanPhone,
          },
          emailRedirectTo: `${window.location.origin}/login?confirmed=true`,
        },
      });
      if (error) throw error;
      setSuccess("Cadastro realizado! Verifique seu email para confirmar a conta.");
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-[hsl(var(--blue-900))]">
      {/* Botão claro/escuro removido — app tem apenas dark mode fixo. */}

      {/* ── HERO ─────────────────────────────────────────────────────────
          Desktop: coluna esquerda (lg:flex-1, h tela inteira).
          Mobile: bloco no topo. Imagem ocupa metade superior do hero
          (full-bleed sem texto), texto fica abaixo no fundo navy. */}
      <aside className="relative flex flex-col lg:overflow-hidden lg:flex-1 lg:border-r border-white/5 lg:min-h-screen">
        {/* ── MOBILE: imagem hero compacta (~28vh) com Carla centralizada.
            A Carla está em ~65% horizontal da imagem original (1376x768).
            Com object-[65%_center] o crop pega ela bem no centro. */}
        <div className="lg:hidden relative w-full h-[28vh] min-h-[200px] max-h-[260px] overflow-hidden">
          <img
            src="/hero/area-de-membros.jpg"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-[65%_center]"
            fetchPriority="high"
          />
          {/* Gradient sutil só na base pra emendar com o fundo navy */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[hsl(var(--blue-900))] z-10" />
          <div className="caution-tape absolute top-0 left-0 right-0 h-2 z-30" aria-hidden />
          {/* Logo flutuante sobre a imagem */}
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

        {/* ── MOBILE: texto centralizado abaixo da imagem ───────────────── */}
        <div className="lg:hidden px-6 pt-3 pb-3 bg-[hsl(var(--blue-900))] text-center">
          <p className="inline-block px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[9px] font-black uppercase tracking-widest text-primary mb-2">
            🛞 Sua área de membros
          </p>
          <h1 className="text-white font-black text-xl sm:text-2xl leading-[1.05] tracking-tight">
            O volante <span className="text-primary">agora é seu.</span>
          </h1>
        </div>

        {/* ── DESKTOP: layout completo com imagem cobrindo a coluna ────── */}
        <div className="hidden lg:block absolute inset-0">
          <img
            src="/hero/area-de-membros.jpg"
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

      {/* ── FORMULÁRIO ────────────────────────────────────────────────────
          Mobile: bloco abaixo do hero, fundo navy sólido (sem imagem
          embaçada — a capa já apareceu no hero acima).
          Desktop: coluna direita lg:w-[480px], card sem glass. */}
      <main className="flex-1 lg:flex-none lg:w-[480px] xl:w-[540px] flex items-start lg:items-center justify-center px-6 pt-3 pb-4 sm:p-8 lg:p-10 relative bg-[hsl(var(--blue-900))]">
        <div className="relative z-10 w-full max-w-md lg:max-w-none lg:bg-transparent lg:p-0">
          {/* Logo agora vive no hero acima, o form começa direto pelo título */}
          <div className="text-center lg:text-left mb-3 lg:mb-8">
            <h2 className="text-lg lg:text-3xl font-black text-white tracking-tight">
              {isLogin ? "Bem-vinda de volta" : "Liberar acesso"}
            </h2>
            <p className="text-white/50 text-xs lg:text-sm mt-0.5 lg:mt-2">
              {isLogin
                ? "Entre na sua conta pra continuar"
                : signupStep === "email"
                ? "Confirme seu email pra começar"
                : signupStep === "enrolled"
                ? "Conclua seu cadastro"
                : "Acesso restrito a alunos"}
            </p>
          </div>

        <div className="flex bg-white/[0.08] rounded-xl p-1 mb-4 lg:mb-6">
          <button
            onClick={() => switchTab(true)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isLogin ? "bg-primary text-primary-foreground shadow-md" : "text-white/40 hover:text-white/60"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => switchTab(false)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              !isLogin ? "bg-primary text-primary-foreground shadow-md" : "text-white/40 hover:text-white/60"
            }`}
          >
            Primeiro acesso
          </button>
        </div>

        {/* Erros e mensagens de sucesso (compartilhados pelos 3 estados) */}
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

        {/* === LOGIN === */}
        {isLogin && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {welcomeBack && (
              <div className="bg-primary/15 border border-primary/30 rounded-xl px-4 py-4 text-center">
                <div className="text-2xl mb-1.5">👋</div>
                <p className="text-white text-sm font-bold leading-relaxed">
                  Bem-vindo de volta!
                </p>
                <p className="text-white/70 text-xs mt-1.5 leading-relaxed italic">
                  {welcomeBack.phrase}
                </p>
                <p className="text-white/60 text-xs mt-2 font-medium">
                  Faça o login para continuar.
                </p>
              </div>
            )}
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
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
                minLength={6}
                placeholder="Mínimo 6 caracteres"
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
        )}

        {/* === CADASTRO — ETAPA 1: VERIFICAR EMAIL === */}
        {!isLogin && signupStep === "email" && (
          <form onSubmit={handleCheckEnrollment} className="flex flex-col gap-4">
            <p className="text-white/60 text-sm leading-relaxed -mt-2">
              Digite o email que você usou na compra do curso para liberar seu acesso.
            </p>
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Email da compra</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1 flex items-center justify-center gap-2"
            >
              {loading ? "Verificando..." : (
                <>
                  <span className="material-symbols-outlined text-base">key</span>
                  Liberar acesso
                </>
              )}
            </button>
          </form>
        )}

        {/* === CADASTRO — ETAPA 2A: ALUNO MATRICULADO === */}
        {!isLogin && signupStep === "enrolled" && (
          <form onSubmit={handleCompleteSignup} className="flex flex-col gap-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-4 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-green-300 text-sm font-bold leading-relaxed">
                Que bom! Você já é nosso aluno!
              </p>
              <p className="text-green-200/80 text-xs mt-1">
                Conclua o cadastro e seja Bem-Vindo!
              </p>
            </div>

            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] text-white/60 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Nome completo</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                autoFocus
                placeholder="Seu nome"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Celular com DDD</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                placeholder="(11) 98765-4321"
                inputMode="tel"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Crie uma senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? "Criando conta..." : "Concluir cadastro ✨"}
            </button>
            <button
              type="button"
              onClick={goBackToEmail}
              className="text-white/40 hover:text-white/60 text-xs font-medium transition-colors"
            >
              ← Usar outro email
            </button>
          </form>
        )}

        {/* === CADASTRO — ETAPA 2B: NÃO É ALUNO === */}
        {!isLogin && signupStep === "not-enrolled" && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-5 text-center">
              <div className="text-3xl mb-2">😕</div>
              <p className="text-amber-200 text-sm font-bold leading-relaxed">
                Ops, parece que você ainda não é nosso aluno.
              </p>
              <p className="text-amber-100/80 text-xs mt-2 leading-relaxed">
                Clique no link abaixo e realize a sua matrícula.
              </p>
            </div>

            <a
              href={SALES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">shopping_cart</span>
              Realizar matrícula
            </a>

            <button
              type="button"
              onClick={goBackToEmail}
              className="text-white/40 hover:text-white/60 text-xs font-medium transition-colors"
            >
              ← Usar outro email
            </button>
          </div>
        )}
        </div>
      </main>

      {/* Botão flutuante de suporte WhatsApp + chat guiado */}
      <SupportChat />
    </div>
  );
};

export default Auth;
