import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SupportChat } from "@/components/SupportChat";
// regional-flavor mantido no projeto pra reativação pós-login no futuro.

// Vídeos de fundo: pessoas dirigindo, vista do interior do carro.
// Hospedados no CDN do Pexels (licença livre, sem atribuição obrigatória).
const BG_VIDEOS = [
  // Homem dirigindo em estrada de campo (1920x1080)
  "https://videos.pexels.com/video-files/4252063/4252063-hd_1920_1080_24fps.mp4",
  // Mulher dirigindo na estrada (1920x1080)
  "https://videos.pexels.com/video-files/3525673/3525673-hd_1920_1080_24fps.mp4",
  // POV pessoa dirigindo (2732x1152, ultra-wide)
  "https://videos.pexels.com/video-files/13967042/13967042-uhd_2732_1152_24fps.mp4",
  // Dash cam vista da estrada do interior do carro (2560x1440)
  "https://videos.pexels.com/video-files/5921059/5921059-uhd_2560_1440_30fps.mp4",
];

/**
 * Galeria infinita horizontal de vídeos.
 * - A lista é duplicada uma vez para criar um loop sem costura quando o
 *   track desliza -50% via animação CSS (`video-marquee` em index.css).
 * - `preload="metadata"` comporta-se como um proxy: só baixa os primeiros bytes
 *   (metadata + 1º frame) de cada vídeo, mantendo o tempo de carregamento da
 *   página leve. O vídeo inteiro só começa a streamar quando entra em viewport.
 * - Opacidade idêntica ao layout anterior (0.15) para preservar as cores.
 */
const VideoBackground = () => {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [readyCount, setReadyCount] = useState(0);
  const allReady = readyCount >= BG_VIDEOS.length;

  // Duplica a lista para o loop infinito ficar contínuo (sem corte).
  const loopVideos = [...BG_VIDEOS, ...BG_VIDEOS];

  // Tenta dar play em cada vídeo assim que carrega. Browsers móveis exigem
  // muted + playsInline, ambos já configurados.
  useEffect(() => {
    videoRefs.current.forEach((v) => {
      if (!v) return;
      v.play().catch(() => {});
    });
  }, []);

  const handleCanPlay = useCallback((isOriginal: boolean) => {
    // Só conta os 4 originais para o estado "tudo pronto"
    if (isOriginal) setReadyCount((n) => Math.min(n + 1, BG_VIDEOS.length));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className={`video-marquee-track flex h-full transition-opacity duration-1000 ease-out ${
          allReady ? "opacity-[0.15]" : "opacity-0"
        }`}
      >
        {loopVideos.map((src, i) => {
          const isOriginal = i < BG_VIDEOS.length;
          return (
            <video
              key={i}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={src}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              onCanPlay={() => handleCanPlay(isOriginal)}
              className="h-full w-[80vw] md:w-[55vw] lg:w-[40vw] object-cover flex-shrink-0"
            />
          );
        })}
      </div>
    </div>
  );
};

// URL de vendas — temporariamente apontando pro WhatsApp do suporte.
// TODO: trocar pela URL da página de vendas (Hotmart/Kiwify/site próprio) quando estiver no ar.
const SALES_URL =
  "https://wa.me/5521993685289?text=Ol%C3%A1!%20Quero%20saber%20sobre%20o%20curso%20Medo%20de%20Dirigir%20Nunca%20Mais.";

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
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--blue-900))] px-4 relative overflow-hidden">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 size-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-md"
        title={isDark ? "Modo Claro" : "Modo Escuro"}
      >
        <span className="material-symbols-outlined text-xl">{isDark ? "light_mode" : "dark_mode"}</span>
      </button>
      <VideoBackground />
      <div className="relative z-10 bg-white/5 backdrop-blur-xl rounded-2xl p-8 md:p-10 max-w-md w-full border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 bg-primary/20 rounded-xl mb-4">
            <span className="material-symbols-outlined text-primary text-3xl">directions_car</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Medo de Dirigir Nunca Mais
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {isLogin
              ? "Entre na sua conta para continuar"
              : signupStep === "email"
              ? "Liberar acesso"
              : signupStep === "enrolled"
              ? "Conclua seu cadastro"
              : "Acesso restrito a alunos"}
          </p>
        </div>

        <div className="flex bg-white/[0.08] rounded-xl p-1 mb-6">
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
            Cadastrar
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

      {/* Botão flutuante de suporte WhatsApp + chat guiado */}
      <SupportChat />
    </div>
  );
};

export default Auth;
