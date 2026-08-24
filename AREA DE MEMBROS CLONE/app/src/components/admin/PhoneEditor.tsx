import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── PhoneEditor ─────────────────────────────────────────────────────────────
// Input pra editar o telefone da aluna no painel admin. Salva via RPC
// admin_set_student_phone (SECURITY DEFINER, valida admin + normaliza digitos).
//
// Útil pra preencher manualmente dados de alunas antigas que foram cadastradas
// antes do webhook v17 (que agora persiste o phone do payload Eduzz).
// =============================================================================

interface Props {
  userId: string;
  currentPhone: string | null;
  onSaved: () => void;
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 13);
  if (!d) return "";
  // Se começa com 55, mascara como BR completo: 55 (11) 98765-4321
  if (d.startsWith("55") && d.length >= 4) {
    const rest = d.slice(2);
    const dd = rest.slice(0, 2);
    const left = rest.slice(2, 7);
    const right = rest.slice(7, 11);
    return `55 (${dd})${left ? " " + left : ""}${right ? "-" + right : ""}`;
  }
  // Sem 55 (10 ou 11 dígitos): (11) 98765-4321
  const dd = d.slice(0, 2);
  const left = d.slice(2, 7);
  const right = d.slice(7, 11);
  return `(${dd})${left ? " " + left : ""}${right ? "-" + right : ""}`;
}

export function PhoneEditor({ userId, currentPhone, onSaved }: Props) {
  const [value, setValue] = useState<string>(maskPhone(currentPhone || ""));
  const [saving, setSaving] = useState(false);

  const rawDigits = value.replace(/\D/g, "");
  const isDirty = rawDigits !== (currentPhone || "").replace(/\D/g, "");
  const isValid = rawDigits === "" || (rawDigits.length >= 10 && rawDigits.length <= 13);

  async function save() {
    if (!isValid) return;
    setSaving(true);
    // @ts-ignore — RPC nova
    const { data, error } = await supabase.rpc("admin_set_student_phone", {
      p_user_id: userId,
      p_phone: rawDigits,
    });
    setSaving(false);

    if (error) {
      toast.error("Não consegui salvar o telefone", { description: error.message });
      return;
    }
    toast.success(
      rawDigits ? "Telefone atualizado" : "Telefone removido",
      {
        description: rawDigits
          ? "Agora dá pra clicar e abrir o WhatsApp direto."
          : "Aluna ficou sem telefone cadastrado.",
      }
    );
    onSaved();
  }

  const waLink = rawDigits.length >= 10 ? `https://wa.me/${rawDigits}` : null;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">
        📱 Telefone (WhatsApp)
      </label>
      <div className="flex items-center gap-2">
        <input
          type="tel"
          value={value}
          onChange={(e) => setValue(maskPhone(e.target.value))}
          placeholder="(11) 98765-4321"
          inputMode="tel"
          className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-mono focus:outline-none focus:border-primary"
        />
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 size-10 rounded-xl bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366] hover:text-white flex items-center justify-center transition-colors"
            title={`Abrir WhatsApp do(a) aluno(a)`}
          >
            <span className="material-symbols-outlined text-base">chat</span>
          </a>
        )}
        <button
          onClick={save}
          disabled={!isDirty || !isValid || saving}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "..." : "Salvar"}
        </button>
      </div>
      {!isValid && rawDigits.length > 0 && (
        <p className="text-[10px] text-destructive mt-1.5">
          Telefone precisa ter 10 a 13 dígitos (com ou sem 55 + DDD).
        </p>
      )}
      {!currentPhone && (
        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
          Sem telefone cadastrado. Você pode preencher manualmente.
        </p>
      )}
    </div>
  );
}
