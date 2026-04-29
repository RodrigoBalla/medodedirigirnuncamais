import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Product } from "@/types/lms";

interface Props {
  product: Product;
  onUpdate: () => void;
}

export default function ProductInfoTab({ product, onUpdate }: Props) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description || "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ title, description })
      .eq("id", product.id);

    if (error) {
      toast.error("Erro ao salvar informações");
    } else {
      toast.success("Produto atualizado com sucesso!");
      onUpdate();
    }
    setSaving(false);
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
      <h3 className="text-xl font-bold mb-6">Informações Gerais</h3>
      
      <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
        <div>
          <label className="text-sm font-bold block mb-1.5">Título do Produto</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-all"
            required
            maxLength={100}
          />
          <p className="text-[10px] text-muted-foreground mt-1.5 text-right">{title.length}/100</p>
        </div>

        <div>
          <label className="text-sm font-bold block mb-1.5">Descrição</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Descreva sobre o que é este curso/módulo..."
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-all resize-none"
          />
        </div>

        {/* Thumbnail mockup space */}
        <div>
          <label className="text-sm font-bold block mb-1.5">Capa do Produto</label>
          <div className="flex gap-4">
             <div className="w-48 h-28 bg-muted rounded-xl border border-dashed border-border flex items-center justify-center flex-col gap-2 cursor-pointer hover:bg-accent/50 transition-colors">
                <span className="material-symbols-outlined text-muted-foreground text-3xl">add_photo_alternate</span>
                <span className="text-xs font-bold text-muted-foreground">Adicionar Imagem</span>
             </div>
             <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
               A imagem principal que será exibida para os alunos na vitrine e na biblioteca. <br/>(Recomendado: 1920x1080px)
             </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border mt-8 flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : null}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
