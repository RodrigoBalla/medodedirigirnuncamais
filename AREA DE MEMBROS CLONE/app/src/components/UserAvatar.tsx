import { useAvatarUrl } from "@/hooks/useAvatarUrl";

// ─── UserAvatar ──────────────────────────────────────────────────────────────
// Avatar redondo READ-ONLY do user logado. Mostra a foto que ele subiu (via
// hook useAvatarUrl) ou a inicial do nome como fallback.
//
// Cada user vê APENAS a sua foto — useAvatarUrl filtra por auth.uid() e
// se atualiza automaticamente quando o user faz upload (evento global).
//
// Pra avatar EDITÁVEL (com upload), use <AvatarUploader />.
// =============================================================================

interface Props {
  displayName?: string | null;
  /** Tamanho em px. Default 36 (header). Sidebar usa 44, profile usa 96. */
  size?: number;
  /** Tailwind class do estilo da borda — default border-2 border-primary/30 */
  borderClassName?: string;
  className?: string;
}

export function UserAvatar({
  displayName,
  size = 36,
  borderClassName = "border-2 border-primary/30",
  className,
}: Props) {
  const { url } = useAvatarUrl();
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";
  const fontSize = Math.round(size * 0.42);

  return (
    <div
      className={`rounded-full bg-primary/10 ${borderClassName} flex items-center justify-center text-primary font-bold overflow-hidden ${className ?? ""}`}
      style={{ width: size, height: size, fontSize }}
      aria-label={displayName ? `Avatar de ${displayName}` : "Avatar"}
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
  );
}
