import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateDisplayName } from "@/hooks/useDisplayName";
import { useTrackMission } from "@/hooks/useTrackMission";
import { toast } from "sonner";

// ─── EditableDisplayName ─────────────────────────────────────────────────────
// h1 do nome do user no /perfil que vira input ao clicar. Salva no banco
// (profiles.display_name) e propaga em todos os outros lugares via evento
// global (header, sidebar mini).
//
// Modos:
//   - View: <h1> com hover sutil e ícone "edit" pequeno indicando que dá pra
//     clicar. Click → entra em edit mode.
//   - Edit: <input> focado, Enter salva, Escape cancela, ✕ cancela, ✓ salva.
// =============================================================================

interface Props {
  value: string;
  className?: string;
}

export function EditableDisplayName({ value, className }: Props) {
  const { user } = useAuth();
  const { trackProgress } = useTrackMission();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sempre que value externo mudar (ex: hook atualizou), sincroniza draft
  useEffect(() => { setDraft(value); }, [value]);

  // Auto-foca + seleciona quando entra em edit
  useEffect(() => {
    if (editing) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => clearTimeout(t);
    }
  }, [editing]);

  async function save() {
    if (!user) return;
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    if (trimmed.length < 2) {
      toast.error("Nome muito curto (mínimo 2 letras).");
      return;
    }
    setSaving(true);
    try {
      await updateDisplayName(user.id, trimmed);
      // Marca missão "Identidade Pessoal"
      trackProgress("profile_name_edited", 1);
      toast.success("Nome atualizado!");
      setEditing(false);
    } catch (err: any) {
      toast.error("Não foi possível salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex items-center gap-2 group cursor-text ${className ?? ""}`}
        title="Clique pra editar seu nome"
      >
        <span className="text-2xl font-black tracking-tight">{value || "Motorista"}</span>
        <span className="material-symbols-outlined text-base text-muted-foreground/50 group-hover:text-primary transition-colors">
          edit
        </span>
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        maxLength={60}
        disabled={saving}
        className="text-2xl font-black tracking-tight bg-background border-2 border-primary/40 focus:border-primary outline-none rounded-lg px-3 py-1 max-w-[260px] text-center"
        placeholder="Seu nome"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="size-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
        title="Salvar"
        aria-label="Salvar nome"
      >
        <span className="material-symbols-outlined text-lg">{saving ? "hourglass_empty" : "check"}</span>
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="size-9 rounded-full border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
        title="Cancelar"
        aria-label="Cancelar edição"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
}
