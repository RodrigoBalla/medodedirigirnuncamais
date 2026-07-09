import { useSearchParams } from "react-router-dom";
import { NpsSurvey } from "@/components/NpsSurvey";

// ─── /pesquisa ───────────────────────────────────────────────────────────────
// Página PÚBLICA da pesquisa (link pra mandar no WhatsApp). Não precisa de login:
// a aluna informa o email da compra e a resposta/recompensa é vinculada à conta
// daquele email no servidor. Aceita ?email= pra pré-preencher (link personalizado).
// =============================================================================

export default function Pesquisa() {
  const [params] = useSearchParams();
  const prefill = params.get("email") || "";

  return (
    <div className="min-h-screen bg-[#0B1A38] asphalt-texture flex items-center justify-center p-4 md:p-6">
      <div className="caution-tape h-1.5 w-full fixed top-0 left-0" aria-hidden />
      <NpsSurvey initialEmail={prefill} />
    </div>
  );
}
