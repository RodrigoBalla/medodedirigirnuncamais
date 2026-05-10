import { useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAvatarUrl, broadcastAvatarUpdate } from "@/hooks/useAvatarUrl";
import { useTrackMission } from "@/hooks/useTrackMission";
import { toast } from "sonner";

// ─── AvatarUploader ──────────────────────────────────────────────────────────
// Avatar redondo do user que aceita upload de foto. Click → file picker → faz
// upload pro bucket "avatars" do Supabase Storage (path: {user_id}/avatar.<ext>),
// salva URL pública em profiles.avatar_url e atualiza a UI.
//
// Quando não tem foto, mostra a primeira letra do nome (fallback). Hover
// mostra um ícone de câmera por cima sugerindo "clique pra trocar".
//
// Props:
//   - displayName: nome do user (pra fallback "R", "C", etc.)
//   - size: tamanho do círculo em px (default 96 — pra usar como hero do
//     ProfileScreen). Pode passar 44 pra usar como mini avatar na sidebar.
//   - editable: se false, mostra avatar mas sem permitir upload (ex: header)
//   - onUploaded: callback opcional avisando a URL nova (pra parents que
//     precisem reagir, tipo refetch do contexto)
// =============================================================================

interface Props {
  displayName?: string | null;
  size?: number;
  editable?: boolean;
  className?: string;
  onUploaded?: (publicUrl: string) => void;
}

export function AvatarUploader({
  displayName,
  size = 96,
  editable = true,
  className,
  onUploaded,
}: Props) {
  const { user } = useAuth();
  const { trackProgress } = useTrackMission();
  const inputRef = useRef<HTMLInputElement>(null);
  // URL vem do hook compartilhado — qualquer upload em qualquer instância
  // do AvatarUploader (ou refresh de profile) propaga via evento global.
  const { url } = useAvatarUrl();
  const [uploading, setUploading] = useState(false);

  const fontSize = Math.round(size * 0.42);
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";

  const handlePick = useCallback(() => {
    if (!editable || uploading) return;
    inputRef.current?.click();
  }, [editable, uploading]);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validação simples no client (RLS + bucket já limitam no server)
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo precisa ser uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem precisa ter menos de 5MB.");
      return;
    }

    setUploading(true);
    try {
      // Sempre escreve no path {user_id}/avatar.<ext> com upsert pra
      // sobrescrever a foto antiga (1 user = 1 avatar)
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust pro browser pegar a nova versão imediatamente
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

      // Salva no profile do user
      const { error: dbErr } = await supabase.from("profiles").upsert(
        { user_id: user.id, avatar_url: publicUrl },
        { onConflict: "user_id" },
      );
      if (dbErr) throw dbErr;

      // Avisa todos os outros lugares (header, sidebar, etc.) via evento global
      broadcastAvatarUpdate(publicUrl);
      onUploaded?.(publicUrl);
      // Marca missão "Sua Cara Aqui" como completa
      trackProgress("profile_avatar_uploaded", 1);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      console.warn("[avatar] upload error:", err);
      toast.error("Não foi possível atualizar a foto", {
        description: err?.message ?? "Tenta de novo daqui a pouco.",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [user, onUploaded]);

  return (
    <div
      className={`relative group ${editable ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ width: size, height: size }}
      onClick={handlePick}
      role={editable ? "button" : undefined}
      aria-label={editable ? "Trocar foto de perfil" : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={editable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePick(); } } : undefined}
    >
      <div
        className="size-full rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center text-primary font-black overflow-hidden shadow-xl transition-transform group-hover:scale-[1.03]"
        style={{ fontSize }}
      >
        {url ? (
          <img
            src={url}
            alt={displayName || "Avatar"}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {editable && (
        <>
          {/* Overlay com câmera no hover (ou enquanto uploading) */}
          <div
            className={`absolute inset-0 rounded-full bg-black/55 flex items-center justify-center transition-opacity ${
              uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {uploading ? (
              <span
                className="border-2 border-white/30 border-t-white rounded-full animate-spin"
                style={{ width: size * 0.28, height: size * 0.28 }}
                aria-label="Enviando..."
              />
            ) : (
              <span
                className="material-symbols-outlined text-white"
                style={{ fontSize: Math.round(size * 0.32) }}
              >
                photo_camera
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleChange}
            className="sr-only"
            disabled={uploading}
          />
        </>
      )}
    </div>
  );
}
