import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: 16,
    }}>
      <div style={{
        background: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        padding: "40px 36px",
        maxWidth: 420,
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🚘</div>
          <h1 style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "white",
            margin: 0,
            letterSpacing: "-0.5px",
          }}>
            Medo de Dirigir Nunca Mais
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", margin: "8px 0 0" }}>
            {isLogin ? "Entre na sua conta para continuar" : "Crie sua conta de aluno"}
          </p>
        </div>

        <div style={{
          display: "flex",
          background: "rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 4,
          marginBottom: 24,
        }}>
          <button
            onClick={() => { setIsLogin(true); setError(""); setSuccess(""); }}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s",
              background: isLogin ? "rgba(59,130,246,0.9)" : "transparent",
              color: isLogin ? "white" : "rgba(255,255,255,0.5)",
            }}
          >
            Entrar
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(""); setSuccess(""); }}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s",
              background: !isLogin ? "rgba(59,130,246,0.9)" : "transparent",
              color: !isLogin ? "white" : "rgba(255,255,255,0.5)",
            }}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLogin && (
            <div>
              <label style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6, display: "block" }}>
                Nome completo
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required={!isLogin}
                placeholder="Seu nome"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontSize: "0.95rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <div>
            <label style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6, display: "block" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6, display: "block" }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              padding: "10px 14px",
              color: "#fca5a5",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 12,
              padding: "10px 14px",
              color: "#86efac",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}>
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 0",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "white",
              fontSize: "1rem",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s",
              marginTop: 4,
            }}
          >
            {loading ? "Aguarde..." : isLogin ? "Entrar 🚀" : "Criar Conta ✨"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
