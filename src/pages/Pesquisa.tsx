import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NpsSurvey } from "@/components/NpsSurvey";
import { npsDb } from "@/lib/nps";

// ─── /pesquisa ───────────────────────────────────────────────────────────────
// Link EXTERNO da pesquisa (pra mandar no WhatsApp). Como a recompensa cai na
// carteira da aluna, precisa dela logada:
//   • não logada  → manda pro /login (depois cai na área de membros e o popup
//                   da pesquisa dispara sozinho, já que ela é elegível)
//   • elegível    → abre a pesquisa aqui mesmo
//   • já respondeu → "obrigada, você já respondeu"
// =============================================================================

type State = "checking" | "eligible" | "done" | "ineligible";

export default function Pesquisa() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) { nav("/login"); return; }
    let cancel = false;
    (async () => {
      try {
        const { data } = await npsDb.rpc("get_my_nps_status");
        if (cancel) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.already_responded) setState("done");
        else if (row?.should_show) setState("eligible");
        else setState("ineligible");
      } catch {
        if (!cancel) setState("ineligible");
      }
    })();
    return () => { cancel = true; };
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-[#0B1A38] asphalt-texture flex items-center justify-center p-6 text-center">
      <div className="caution-tape h-1.5 w-full fixed top-0 left-0" aria-hidden />

      {(loading || state === "checking") && (
        <div className="animate-spin size-9 border-4 border-primary border-t-transparent rounded-full" />
      )}

      {state === "eligible" && (
        <>
          <div className="max-w-sm">
            <div className="text-6xl mb-4">📋</div>
            <h1 className="text-2xl font-black text-white mb-2" style={{ textWrap: "balance" }}>Sua pesquisa está aqui 💛</h1>
            <p className="text-sm text-white/60 mb-6">Responde rapidinho e ganhe <b className="text-primary">R$ 10 em moedas</b> 🪙 na sua carteira.</p>
            <button onClick={() => nav("/")} className="text-xs font-bold text-white/50 hover:text-white transition-colors">
              Ir pra área de membros
            </button>
          </div>
          {/* Abre o popup da pesquisa por cima */}
          <NpsSurvey />
        </>
      )}

      {state === "done" && (
        <div className="max-w-sm">
          <div className="text-6xl mb-4">💛</div>
          <h1 className="text-2xl font-black text-white mb-2">Você já respondeu!</h1>
          <p className="text-sm text-white/70 mb-6">Muito obrigada — sua opinião já está com a gente. 🙏</p>
          <button onClick={() => nav("/")} className="px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide">
            Ir pra área de membros
          </button>
        </div>
      )}

      {state === "ineligible" && (
        <div className="max-w-sm">
          <div className="text-6xl mb-4">🚗</div>
          <h1 className="text-2xl font-black text-white mb-2">Bem-vinda!</h1>
          <p className="text-sm text-white/70 mb-6">Sua pesquisa aparece assim que você entrar na área de membros.</p>
          <button onClick={() => nav("/")} className="px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wide">
            Entrar
          </button>
        </div>
      )}
    </div>
  );
}
