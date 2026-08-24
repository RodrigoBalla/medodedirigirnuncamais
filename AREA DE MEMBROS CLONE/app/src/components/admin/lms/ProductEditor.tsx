import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Product } from "@/types/lms";

import ProductInfoTab from "./ProductInfoTab";
import ProductContentsTab from "./ProductContentsTab";
import ProductAccessTab from "./ProductAccessTab";

interface Props {
  productId: string;
  onBack: () => void;
}

export default function ProductEditor({ productId, onBack }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "contents" | "access">("info");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  async function fetchProduct() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) {
      toast.error("Erro ao carregar produto");
    } else {
      setProduct(data);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin size-8 border-4 border-primary border-t-transparent flex items-center justify-center rounded-full mx-auto" />
      </div>
    );
  }

  if (!product) {
    return <div className="text-center text-muted-foreground">Produto não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 border border-border rounded-2xl">
         <div className="flex items-center gap-4">
           <button onClick={onBack} className="flex items-center justify-center size-10 rounded-full border border-border hover:bg-accent transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
           </button>
           <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Produtos &gt; Edição
              </p>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                {product.title}
                <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${product.status === 'published' ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' : 'bg-muted text-muted-foreground'}`}>
                  {product.status === 'published' ? 'Publicado' : 'Rascunho'}
                </span>
              </h2>
           </div>
         </div>
         
         <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                const newStatus = product.status === 'published' ? 'draft' : 'published';
                const { error } = await supabase.from('products').update({ status: newStatus }).eq('id', product.id);
                if(error) toast.error("Erro ao publicar");
                else { toast.success(`Produto ${newStatus === 'published' ? 'publicado' : 'desativado'}!`); fetchProduct(); }
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                product.status === 'published'
                  ? 'bg-muted text-foreground border border-border hover:bg-accent'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
              }`}
            >
              {product.status === 'published' ? 'Desativar Produto' : 'Publicar Produto'}
            </button>
         </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border hide-scrollbar">
        {[
          { id: "info", label: "Informações", icon: "data_info_alert" }, 
          { id: "contents", label: "Conteúdos", icon: "format_list_bulleted" }, 
          { id: "access", label: "Grupos de Acesso", icon: "group" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-t-xl transition-all ${
              activeTab === t.id 
                ? "bg-accent/50 text-foreground border-b-2 border-primary" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${activeTab === t.id ? 'filled-icon' : ''}`}>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="animate-in fade-in-50 duration-300">
        {activeTab === "info" && <ProductInfoTab product={product} onUpdate={fetchProduct} />}
        {activeTab === "contents" && <ProductContentsTab productId={product.id} />}
        {activeTab === "access" && <ProductAccessTab productId={product.id} />}
      </div>
    </div>
  );
}
