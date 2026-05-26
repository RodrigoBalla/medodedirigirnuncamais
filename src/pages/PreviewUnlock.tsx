import { useState } from "react";
import { ModuleUnlockedOverlay } from "@/components/ModuleUnlockedOverlay";

// ─── PreviewUnlock ──────────────────────────────────────────────────────────
// Página de PREVIEW pra ver a animação de "novo módulo desbloqueado" sem
// precisar de uma compra real. Útil pra demonstração e debug. NÃO é uma
// rota da experiência da aluna — é só ferramenta interna.
//
// Acessível em: /preview-unlock?course=Dominando%20as%20Balizas
//   - ?course=NOME       → nome do curso (default: "Dominando as Balizas")
//   - ?cover=URL          → URL da capa (default: usa public/modulos/)
// =============================================================================

const DEMO_COURSES = [
  { name: "Medo de Dirigir Nunca Mais — Método Completo", cover: "/modulos/medo-de-dirigir-nunca-mais-9x16.jpg" },
  { name: "Dominando as Balizas", cover: "/modulos/dominando-as-balizas-9x16.jpg" },
  { name: "Dominando as Ladeiras", cover: "/modulos/dominando-as-ladeiras-9x16.jpg" },
  { name: "Dominando as Marchas", cover: "/modulos/dominando-as-marchas-9x16.jpg" },
  { name: "Bônus: O Mapa do Condutor", cover: "/modulos/o-mapa-do-condutor-9x16.jpg" },
];

export default function PreviewUnlock() {
  const params = new URLSearchParams(window.location.search);
  const queryName = params.get("course");
  const queryCover = params.get("cover");

  const initial = queryName
    ? { name: queryName, cover: queryCover || null }
    : DEMO_COURSES[1]; // Default: Balizas

  const [active, setActive] = useState<{ name: string; cover: string | null } | null>(initial);

  if (active) {
    return (
      <ModuleUnlockedOverlay
        courseName={active.name}
        coverUrl={active.cover}
        courseId={null}
        onClose={() => setActive(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1A38] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-[#16264D] rounded-2xl p-6 border border-white/10">
        <h1 className="text-2xl font-black mb-2">🎬 Preview · Módulo Desbloqueado</h1>
        <p className="text-sm text-white/60 mb-6">
          Página de demonstração da animação. Clica num curso pra ver como fica a animação quando uma aluna compra ele.
        </p>
        <div className="flex flex-col gap-2">
          {DEMO_COURSES.map((c) => (
            <button
              key={c.name}
              onClick={() => setActive({ name: c.name, cover: c.cover })}
              className="text-left px-4 py-3 rounded-xl bg-[#FFD60A]/10 hover:bg-[#FFD60A]/20 border border-[#FFD60A]/30 text-[#FFD60A] font-bold text-sm transition-colors"
            >
              ▶ {c.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/40 mt-6 text-center">
          Página interna · não exposta na navegação
        </p>
      </div>
    </div>
  );
}
