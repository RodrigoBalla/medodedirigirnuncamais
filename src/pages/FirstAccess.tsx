import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

// ─── /primeiro-acesso?token=XYZ ──────────────────────────────────────────────
// Página de boas-vindas pra aluna que ACABOU de comprar. Vem do email
// transacional disparado pelo webhook após a compra ser confirmada.
//
// Fluxo:
//   1. Lê `?token=...` da URL
//   2. POST /functions/v1/first-access {action:"validate"} → pega nome/curso
//   3. Mostra "Parabéns, {Nome}!" + confetes + vídeo da Carla + onboarding
//   4. Form de senha forte
//   5. POST /functions/v1/first-access {action:"set_password"} → seta senha
//   6. signInWithPassword com a senha recém criada → cai logada na /biblioteca
//
// Se token for inválido/usado/expirado, mostra mensagem clara + atalho pro
// /login normal.
// =============================================================================

const SUPABASE_URL = "https://qkvinhzwiptfobdvsdtr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdmluaHp3aXB0Zm9iZHZzZHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzE5NzYsImV4cCI6MjA5MDA0Nzk3Nn0.HdleSrgGuymiA3a72aAITy0K5wHaYvcVmESYNzSGZ-M";

interface TokenInfo {
  email: string;
  display_name: string;
  course_title: string;
}

type Stage = "loading" | "celebrating" | "password" | "logging_in" | "error";

export default function FirstAccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [stage, setStage] = useState<Stage>("loading");
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [errorReason, setErrorReason] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fired = useRef(false);

  // ─── 1. Valida token no load ─────────────────────────────────────────────
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (!token) {
      setStage("error");
      setErrorReason("token_missing");
      return;
    }
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/first-access`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "validate", token }),
        });
        const data = await resp.json();
        if (!data?.valid) {
          setStage("error");
          setErrorReason(data?.reason || "token_invalid");
          return;
        }
        setInfo({
          email: data.email,
          display_name: data.display_name || "Aluna",
          course_title: data.course_title || "Medo de Dirigir Nunca Mais",
        });
        setStage("celebrating");
      } catch (e) {
        console.error("[first-access] validate error:", e);
        setStage("error");
        setErrorReason("network_error");
      }
    })();
  }, [token]);

  // ─── Confete quando entra no stage de celebração ─────────────────────────
  useEffect(() => {
    if (stage !== "celebrating") return;
    // Burst principal
    const fire = (originX: number, particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { x: originX, y: 0.45 },
        zIndex: 200,
        ...opts,
        particleCount: Math.floor(220 * particleRatio),
      });
    };
    const palette = ["#FFD60A", "#FFFFFF", "#FFB800", "#0B1A38", "#16264D"];
    setTimeout(() => {
      fire(0.5, 0.25, { spread: 26, startVelocity: 55, colors: palette });
      fire(0.5, 0.2, { spread: 60, colors: palette });
      fire(0.5, 0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: palette });
      fire(0.5, 0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: palette });
      fire(0.5, 0.1, { spread: 120, startVelocity: 45, colors: palette });
    }, 250);

    // Bursts laterais a cada 2.5s pelos próximos 8s
    const intervals: number[] = [];
    [2500, 5000, 7500].forEach((delay) => {
      intervals.push(
        window.setTimeout(() => {
          confetti({ particleCount: 80, spread: 80, origin: { x: 0, y: 0.6 }, colors: palette, zIndex: 200 });
          confetti({ particleCount: 80, spread: 80, origin: { x: 1, y: 0.6 }, colors: palette, zIndex: 200 });
        }, delay),
      );
    });
    return () => intervals.forEach((id) => window.clearTimeout(id));
  }, [stage]);

  // ─── Senha: regras + força ──────────────────────────────────────────────
  const minLen = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = minLen && hasNumber && matches && !submitting;

  async function submitPassword() {
    if (!canSubmit || !info) return;
    setSubmitting(true);
    setStage("logging_in");
    try {
      // 1. Seta senha via edge function
      const setResp = await fetch(`${SUPABASE_URL}/functions/v1/first-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "set_password", token, password }),
      });
      const setData = await setResp.json();
      if (!setData?.ok) {
        toast.error("Não foi possível criar sua senha", {
          description: setData?.reason === "token_already_used"
            ? "Esse link já foi usado. Faça login com sua senha em /login."
            : setData?.reason === "token_expired"
            ? "Esse link expirou. Use o link de redefinir senha no /login."
            : "Tente novamente em alguns segundos.",
        });
        setStage("password");
        setSubmitting(false);
        return;
      }

      // 2. Loga automaticamente
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: info.email,
        password,
      });
      if (signErr) {
        console.error("[first-access] signIn error:", signErr);
        toast.success("Senha criada com sucesso!", {
          description: "Faça login pra entrar.",
        });
        navigate("/login");
        return;
      }

      toast.success(`Bem-vinda, ${info.display_name}! 🎉`);
      navigate("/biblioteca", { replace: true });
    } catch (e) {
      console.error("[first-access] submit error:", e);
      toast.error("Erro de rede. Tenta de novo.");
      setStage("password");
      setSubmitting(false);
    }
  }

  // ─── RENDER: estados de erro ────────────────────────────────────────────
  if (stage === "error") {
    const messages: Record<string, { title: string; sub: string; cta: string }> = {
      token_missing: {
        title: "Link inválido",
        sub: "Esse endereço não contém um código de acesso. Use o link exato que recebeu no seu email.",
        cta: "Ir pra tela de login",
      },
      token_not_found: {
        title: "Link inválido",
        sub: "Esse código não foi encontrado. Verifica se você está abrindo o link mais recente do seu email.",
        cta: "Ir pra tela de login",
      },
      token_already_used: {
        title: "Link já usado",
        sub: "Você já criou sua senha. Use o /login com a senha que definiu.",
        cta: "Fazer login",
      },
      token_expired: {
        title: "Link expirou",
        sub: "Esse link era válido por 7 dias. No /login, clique em \"Esqueci a senha\" pra receber um novo.",
        cta: "Ir pra /login",
      },
      network_error: {
        title: "Erro de rede",
        sub: "Não consegui validar seu link. Tenta recarregar a página em alguns segundos.",
        cta: "Recarregar",
      },
      token_invalid: {
        title: "Link inválido",
        sub: "Não conseguimos validar esse código. Verifica o link do seu email.",
        cta: "Ir pra /login",
      },
    };
    const m = messages[errorReason] || messages.token_invalid;

    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="caution-tape h-1.5 w-full fixed top-0 left-0 right-0" aria-hidden="true" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center"
        >
          <span className="material-symbols-outlined text-amber-500 text-5xl mb-3 block">link_off</span>
          <h1 className="text-xl font-black mb-2">{m.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{m.sub}</p>
          <button
            onClick={() => {
              if (errorReason === "network_error") window.location.reload();
              else navigate("/login");
            }}
            className="w-full bg-primary text-primary-foreground font-black px-4 py-3 rounded-xl uppercase tracking-widest text-xs hover:brightness-110 transition"
          >
            {m.cta}
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── RENDER: loading ────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-3">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Validando seu acesso…
        </p>
      </div>
    );
  }

  // ─── RENDER principal ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-x-clip relative">
      {/* Faixa de identidade visual */}
      <div className="caution-tape h-1.5 w-full" aria-hidden="true" />

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* ─── STAGE: CELEBRATING — Parabéns + vídeo + onboarding ─────── */}
        <AnimatePresence mode="wait">
          {stage === "celebrating" && info && (
            <motion.div
              key="celebrating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              {/* Header: Parabéns */}
              <div className="text-center pt-4">
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-primary mb-3"
                >
                  🎉 Sua matrícula foi confirmada
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 30, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 18 }}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-4"
                  style={{ textWrap: "balance" }}
                >
                  Parabéns,<br />
                  {/* Usa só o PRIMEIRO nome pra não estourar em mobile com nomes
                      longos tipo "Maria do Carmo Silva". Sem .toUpperCase() pra
                      ficar mais natural e legível. */}
                  <span className="text-primary">{(info.display_name || "aluna").trim().split(/\s+/)[0]}!</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-base md:text-lg text-muted-foreground"
                >
                  Você acaba de se matricular no curso{" "}
                  <strong className="text-foreground">{info.course_title}</strong>.
                </motion.p>
              </div>

              {/* Vídeo da Carla — mesmo Vimeo usado na WelcomeScreen original */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/20 bg-black"
              >
                <iframe
                  src="https://player.vimeo.com/video/1170037067?badge=0&autopause=0&controls=1&title=0&byline=0&portrait=0&autoplay=1&muted=1&background=0&dnt=1&quality=auto"
                  className="absolute inset-0 w-full h-full"
                  frameBorder={0}
                  allow="autoplay; fullscreen; picture-in-picture"
                  title="Boas-vindas da Carla"
                />
              </motion.div>

              {/* Onboarding em 3 passos */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 }}
                className="bg-card border border-border rounded-2xl p-5 md:p-6"
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground mb-4">
                  📋 Antes de começar
                </p>
                <ol className="space-y-3">
                  {[
                    "Crie a senha que vai usar pra entrar no app",
                    "Toque em \"Entrar no curso\" pra abrir a área de membros",
                    "Comece pela primeira aula — assista no seu ritmo",
                  ].map((txt, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="shrink-0 size-8 rounded-full bg-primary text-primary-foreground font-black flex items-center justify-center text-sm">
                        {i + 1}
                      </span>
                      <span className="text-sm md:text-base text-foreground leading-snug">{txt}</span>
                    </li>
                  ))}
                </ol>
              </motion.div>

              {/* CTA: avançar pra senha */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="text-center"
              >
                <button
                  onClick={() => setStage("password")}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black px-8 py-4 rounded-2xl shadow-xl shadow-primary/30 uppercase tracking-widest text-sm hover:brightness-110 transition-all"
                >
                  Criar minha senha
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── STAGE: PASSWORD — form pra criar senha ──────────────── */}
          {stage === "password" && info && (
            <motion.div
              key="password"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-6">
                <span className="material-symbols-outlined text-primary text-5xl mb-2 block">lock</span>
                <h2 className="text-2xl md:text-3xl font-black mb-2">Crie sua senha</h2>
                <p className="text-sm text-muted-foreground">
                  Use uma senha que só você sabe. Vai usar pra entrar no app sempre.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
                {/* Email (read-only, só pra confirmar à aluna qual conta é) */}
                <div className="mb-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
                    Sua conta
                  </label>
                  <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground/80">
                    {info.email}
                  </div>
                </div>

                {/* Senha */}
                <div className="mb-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
                    Senha nova
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      autoFocus
                      autoComplete="new-password"
                      className="w-full bg-background border border-border rounded-lg px-3 py-3 pr-10 text-sm font-mono focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-8 text-muted-foreground hover:text-foreground flex items-center justify-center"
                      title={showPwd ? "Esconder" : "Mostrar"}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPwd ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirmar */}
                <div className="mb-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
                    Confirmar senha
                  </label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Digite a mesma senha"
                    autoComplete="new-password"
                    className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Regras visuais */}
                <ul className="space-y-1.5 mb-5 text-xs">
                  <RuleCheck ok={minLen} text="Pelo menos 8 caracteres" />
                  <RuleCheck ok={hasNumber} text="Pelo menos 1 número" />
                  <RuleCheck ok={hasUpper || hasLower} text="Letras (qualquer caixa)" required={false} />
                  <RuleCheck ok={matches} text="Senhas batem" />
                </ul>

                <button
                  onClick={submitPassword}
                  disabled={!canSubmit}
                  className="w-full bg-primary text-primary-foreground font-black px-4 py-3 rounded-xl uppercase tracking-widest text-xs hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {submitting ? "Criando…" : "Entrar no curso"}
                  {!submitting && <span className="material-symbols-outlined text-base">arrow_forward</span>}
                </button>
              </div>

              <button
                onClick={() => setStage("celebrating")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4 underline-offset-2 hover:underline transition-colors"
              >
                ← Voltar
              </button>
            </motion.div>
          )}

          {/* ─── STAGE: LOGGING_IN — loader curto enquanto faz signIn ── */}
          {stage === "logging_in" && (
            <motion.div
              key="logging_in"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-20"
            >
              <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Liberando seu acesso…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Linha de checagem visual de regra de senha. */
function RuleCheck({ ok, text, required = true }: { ok: boolean; text: string; required?: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-[hsl(var(--success))]" : (required ? "text-muted-foreground" : "text-muted-foreground/60")}`}>
      <span className={`material-symbols-outlined text-sm ${ok ? "text-[hsl(var(--success))]" : "text-muted-foreground/60"}`}>
        {ok ? "check_circle" : (required ? "radio_button_unchecked" : "circle")}
      </span>
      <span>{text}</span>
    </li>
  );
}
