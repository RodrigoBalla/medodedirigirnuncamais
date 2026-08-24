import { AnnouncementPopup } from "@/components/AnnouncementPopup";

// ─── PreviewAlert ────────────────────────────────────────────────────────────
// Página interna pra ver como fica o POPUP de aviso (novas aulas) que a aluna
// recebe — sem precisar logar como aluna. Só ferramenta de demonstração.
// Acessível em: /preview-alert
// =============================================================================

export default function PreviewAlert() {
  return (
    <div className="min-h-screen bg-background asphalt-texture">
      {/* fundo simulando a área de membros */}
      <div className="caution-tape h-1.5 w-full" aria-hidden="true" />
      <div className="p-6 text-muted-foreground text-sm">
        Preview do aviso de novas aulas (é isso que a aluna vê no próximo login).
      </div>
      <AnnouncementPopup
        previewData={{
          id: "preview",
          key: "preview",
          title: "14 aulas novas no Método Completo!",
          body: "Acabei de adicionar 14 aulas novas no seu módulo do Método Completo — de ajeitar o banco do jeito certo até o que fazer na hora H da prova. Já está tudo liberado pra você. Bora assistir? 💛",
          emoji: "🚗",
          cta_label: "Ver as aulas novas",
          cta_route: "/biblioteca",
          cta_href: null,
        }}
      />
    </div>
  );
}
