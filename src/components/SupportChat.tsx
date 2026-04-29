import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// CONFIG — atualizar quando os links/webhooks finais estiverem prontos.
// =============================================================================

// Webhook que recebe os dados do lead (nome + telefone) quando o aluno pede
// suporte. Conecte aqui sua automação (Zapier / Make / n8n / Supabase Edge
// Function) que vai entregar os dados no seu WhatsApp pessoal.
//
// Espera-se um POST JSON com o seguinte payload:
//   {
//     type: "support_request",
//     reason: "access-issue",
//     name: string,
//     phone: string,
//     submittedAt: string (ISO 8601)
//   }
const LEAD_WEBHOOK_URL = ""; // ex.: "https://hooks.zapier.com/hooks/catch/123/abc"

// URL da página de vendas (mesma constante do Auth.tsx).
// TODO: trocar pela URL definitiva quando a página de vendas estiver no ar.
const SALES_URL =
  "https://wa.me/5521993685289?text=Ol%C3%A1!%20Quero%20saber%20sobre%20o%20curso%20Medo%20de%20Dirigir%20Nunca%20Mais.";

// =============================================================================
// TIPOS
// =============================================================================

type ChatStep = "menu" | "no-access" | "access-issue" | "course-info" | "form-submitted";

interface Message {
  id: string;
  from: "bot" | "user";
  text: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const newId = () => Math.random().toString(36).slice(2, 9);

/**
 * Envia o lead para a automação configurada em LEAD_WEBHOOK_URL.
 * Usa `mode: "no-cors"` por padrão pra evitar problemas de CORS — a maioria
 * dos webhooks (Zapier/Make/n8n) aceita esse modo, e nesse caso a resposta é
 * opaque (sem status), então sempre tratamos como sucesso. Se você quiser
 * receber a resposta do webhook, troque para `mode: "cors"` e configure CORS
 * no provedor.
 */
async function sendLead(payload: Record<string, unknown>) {
  if (!LEAD_WEBHOOK_URL) {
    // Fallback de desenvolvimento: apenas registra no console.
    // Em produção, configure LEAD_WEBHOOK_URL com o endpoint real.
    console.warn("[SupportChat] LEAD_WEBHOOK_URL não configurado — lead capturado localmente:", payload);
    return;
  }
  await fetch(LEAD_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// COMPONENTE
// =============================================================================

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ChatStep>("menu");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mensagem inicial quando o chat abre pela primeira vez.
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: newId(),
          from: "bot",
          text: "Oi! 👋 Sou da equipe do Medo de Dirigir Nunca Mais. Em que posso te ajudar agora?",
        },
      ]);
    }
  }, [open, messages.length]);

  // Auto-scroll quando uma nova mensagem chega.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping]);

  /** Adiciona uma mensagem do usuário e simula o "digitando" do bot, depois cospe as respostas. */
  const sendUserMessage = async (userText: string, botResponses: string[], nextStep: ChatStep) => {
    setMessages((prev) => [...prev, { id: newId(), from: "user", text: userText }]);
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 700));
    for (const text of botResponses) {
      setMessages((prev) => [...prev, { id: newId(), from: "bot", text }]);
      // Pequena pausa entre mensagens consecutivas pra não vir tudo de uma vez.
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsTyping(false);
    setStep(nextStep);
  };

  const handleNoAccess = () =>
    sendUserMessage(
      "Ainda não tenho acesso, o que devo fazer?",
      [
        "Tranquilo! 😊 Pra liberar seu acesso, primeiro você precisa fazer sua matrícula no curso.",
        "Te mandei o link logo abaixo — depois de comprar, é só voltar aqui e cadastrar com o mesmo email da compra.",
      ],
      "no-access"
    );

  const handleAccessIssue = () =>
    sendUserMessage(
      "Já sou aluno e não consigo acessar.",
      [
        "Poxa! 😟 Vamos resolver isso pra você agora.",
        "Me passa seu nome e telefone que a gente abre seu chamado e te chama no WhatsApp em seguida.",
      ],
      "access-issue"
    );

  const handleCourseInfo = () =>
    sendUserMessage(
      "Quero saber mais sobre o curso.",
      [
        "Eba! 🎉 Adoro falar sobre isso.",
        "O Medo de Dirigir Nunca Mais é um treinamento gamificado, no seu ritmo, pra quem trava ao volante.",
        "Você aprende em fases curtas e práticas — começa eliminando a ansiedade do carro parado e vai evoluindo até dirigir no trânsito real, com confiança. 🚗💪",
        "Tudo no celular, quantas vezes precisar, com nosso 'instrutor virtual' do seu lado pra cada dúvida.",
        "Quer ver os detalhes e os depoimentos das alunas?",
      ],
      "course-info"
    );

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || !cleanPhone) return;

    setIsTyping(true);
    setMessages((prev) => [
      ...prev,
      { id: newId(), from: "user", text: `Nome: ${cleanName}\nTelefone: ${cleanPhone}` },
    ]);

    try {
      await sendLead({
        type: "support_request",
        reason: "access-issue",
        name: cleanName,
        phone: cleanPhone,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Falha silenciosa do webhook — não trava o usuário, só registra.
      console.error("[SupportChat] Falha ao enviar lead:", err);
    }

    await new Promise((r) => setTimeout(r, 600));
    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        from: "bot",
        text: "Pronto! Recebemos seus dados. ✅\nA gente te chama no seu WhatsApp em instantes.",
      },
    ]);
    setIsTyping(false);
    setStep("form-submitted");
  };

  const goBackToMenu = () => {
    setStep("menu");
    setMessages([
      {
        id: newId(),
        from: "bot",
        text: "Beleza! Em que mais posso te ajudar?",
      },
    ]);
    setName("");
    setPhone("");
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <>
      {/* Botão flutuante */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        animate={!open ? { y: [0, -6, 0] } : {}}
        transition={!open ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
        className="fixed bottom-5 right-5 z-[100] size-14 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] text-white shadow-2xl shadow-green-500/40 flex items-center justify-center border-2 border-white/20"
        aria-label={open ? "Fechar chat" : "Abrir chat de suporte"}
      >
        <span className="material-symbols-outlined text-3xl filled-icon">
          {open ? "close" : "chat"}
        </span>
        {!open && (
          <span className="absolute -top-1 -right-1 size-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </motion.button>

      {/* Painel do chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed bottom-24 right-5 left-5 sm:left-auto sm:w-[380px] z-[100] max-h-[70vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
              <div className="size-10 rounded-full bg-[#25D366] flex items-center justify-center">
                <span className="material-symbols-outlined text-xl filled-icon">support_agent</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">Suporte — Medo de Dirigir</p>
                <p className="text-[11px] flex items-center gap-1 opacity-90">
                  <span className="size-2 bg-green-400 rounded-full animate-pulse" />
                  online agora
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="size-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Mensagens */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-2"
              style={{
                background:
                  "repeating-linear-gradient(45deg, hsl(var(--muted)/0.2), hsl(var(--muted)/0.2) 12px, hsl(var(--muted)/0.3) 12px, hsl(var(--muted)/0.3) 24px)",
              }}
            >
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                      m.from === "user"
                        ? "bg-[#DCF8C6] text-gray-900 rounded-br-sm"
                        : "bg-white text-gray-900 rounded-bl-sm dark:bg-card dark:text-foreground dark:border dark:border-border"
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-card dark:border dark:border-border px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                    <span className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Área de ação (muda conforme o step) */}
            <div className="border-t border-border bg-card p-3">
              {step === "menu" && !isTyping && (
                <div className="flex flex-col gap-2">
                  <QuickReply onClick={handleNoAccess} icon="lock_open">
                    Ainda não tenho acesso, o que devo fazer?
                  </QuickReply>
                  <QuickReply onClick={handleAccessIssue} icon="support">
                    Já sou aluno e não consigo acessar.
                  </QuickReply>
                  <QuickReply onClick={handleCourseInfo} icon="info">
                    Quero saber mais sobre o curso.
                  </QuickReply>
                </div>
              )}

              {step === "no-access" && !isTyping && (
                <div className="flex flex-col gap-2">
                  <a
                    href={SALES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">shopping_cart</span>
                    Ir pra página de vendas
                  </a>
                  <button onClick={goBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">
                    ← Voltar ao menu
                  </button>
                </div>
              )}

              {step === "access-issue" && !isTyping && (
                <form onSubmit={handleSubmitTicket} className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Seu nome"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="Telefone com DDD"
                    inputMode="tel"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={isTyping}
                    className="w-full py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1ebe5b] transition-all flex items-center justify-center gap-2 shadow-md shadow-green-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base filled-icon">support_agent</span>
                    {isTyping ? "Enviando..." : "Abrir chamado"}
                  </button>
                  <button type="button" onClick={goBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">
                    ← Voltar ao menu
                  </button>
                </form>
              )}

              {step === "course-info" && !isTyping && (
                <div className="flex flex-col gap-2">
                  <a
                    href={SALES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    Ver página de vendas
                  </a>
                  <button onClick={goBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">
                    ← Voltar ao menu
                  </button>
                </div>
              )}

              {step === "form-submitted" && !isTyping && (
                <button
                  onClick={goBackToMenu}
                  className="w-full py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary text-sm font-medium transition-all"
                >
                  Voltar ao início do chat
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Componente auxiliar: botão de resposta rápida
// ---------------------------------------------------------------------------
function QuickReply({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-accent hover:border-primary text-sm font-medium text-foreground transition-all"
    >
      <span className="material-symbols-outlined text-primary text-lg mt-0.5">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
