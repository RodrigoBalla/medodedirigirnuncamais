import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const BG_VIDEOS = [
  "https://videos.pexels.com/video-files/2053100/2053100-uhd_2560_1440_30fps.mp4",
  "https://videos.pexels.com/video-files/3945585/3945585-uhd_2560_1440_25fps.mp4",
  "https://videos.pexels.com/video-files/2795391/2795391-uhd_2560_1440_25fps.mp4",
  "https://videos.pexels.com/video-files/1321208/1321208-uhd_2560_1440_25fps.mp4",
];

const VideoBackground = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % BG_VIDEOS.length);
        setFadingOut(false);
      }, 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {BG_VIDEOS.map((src, i) => (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === activeIndex && !fadingOut ? "opacity-[0.15]" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSuccess("Cadastro realizado! Verifique seu email para confirmar a conta.");
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--blue-900))] px-4 relative overflow-hidden">
      <VideoBackground />
      <div className="relative z-10 bg-white/5 backdrop-blur-xl rounded-2xl p-8 md:p-10 max-w-md w-full border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
            <span className="material-symbols-outlined text-primary text-3xl">directions_car</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Medo de Dirigir Nunca Mais
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {isLogin ? "Entre na sua conta para continuar" : "Crie sua conta de aluno"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/8 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(""); setSuccess(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isLogin ? "bg-primary text-white shadow-md" : "text-white/40 hover:text-white/60"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(""); setSuccess(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              !isLogin ? "bg-primary text-white shadow-md" : "text-white/40 hover:text-white/60"
            }`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div>
              <label className="text-white/60 text-xs font-semibold mb-1.5 block">Nome completo</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required={!isLogin}
                placeholder="Seu nome"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
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

          {error && (
            <div className="bg-destructive/15 border border-destructive/30 rounded-xl px-4 py-3 text-red-300 text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 text-green-300 text-sm font-medium">
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Aguarde..." : isLogin ? "Entrar 🚀" : "Criar Conta ✨"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
