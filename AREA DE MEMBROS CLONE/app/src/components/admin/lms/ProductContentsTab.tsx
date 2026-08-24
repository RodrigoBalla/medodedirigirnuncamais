import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Module, Lesson } from "@/types/lms";
import { ChallengeEditor } from "./ChallengeEditor";

interface Props {
  productId: string;
}

export default function ProductContentsTab({ productId }: Props) {
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Modals
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLessonForChallenge, setSelectedLessonForChallenge] = useState<string | null>(null);

  // Forms
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  useEffect(() => {
    fetchContent();
  }, [productId]);

  async function fetchContent() {
    setLoading(true);
    const { data: mods } = await supabase.from("modules").select("*").eq("product_id", productId).order("order_index");
    if (mods) {
      setModules(mods);
      const modIds = mods.map(m => m.id);
      if (modIds.length > 0) {
         const { data: less } = await supabase.from("lessons").select("*").in("module_id", modIds).order("order_index");
         if (less) setLessons(less);
      } else {
         setLessons([]);
      }
    }
    setLoading(false);
  }

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleTitle.trim()) return;

    const { error } = await supabase.from("modules").insert({
      product_id: productId,
      title: moduleTitle.trim(),
      order_index: modules.length
    });

    if (error) toast.error("Erro ao criar módulo");
    else {
      toast.success("Módulo criado!");
      setModuleTitle("");
      setIsModuleModalOpen(false);
      fetchContent();
    }
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonTitle.trim() || !selectedModuleId) return toast.error("Preencha título e módulo");

    let finalVideoUrl = "";

    // If uploading file directly through Supabase Storage
    if (uploadingFile) {
      if (!uploadingFile.type.includes('video')) {
         return toast.error("Por favor selecione apenas arquivos de vídeo (.mp4)");
      }
      
      try {
        setUploadProgress(10);
        const fileName = `${Date.now()}_${uploadingFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("course-videos")
          .upload(fileName, uploadingFile, {
             cacheControl: '3600',
             upsert: false
          });
        
        if (uploadError) throw uploadError;
        setUploadProgress(70);

        const { data: publicUrlData } = supabase.storage.from("course-videos").getPublicUrl(fileName);
        finalVideoUrl = publicUrlData.publicUrl;
        setUploadProgress(90);
      } catch (err) {
        toast.error("Erro no upload do vídeo");
        console.error(err);
        setUploadProgress(0);
        return;
      }
    }

    const { error } = await supabase.from("lessons").insert({
      module_id: selectedModuleId,
      title: lessonTitle.trim(),
      content: lessonContent.trim(),
      video_url: finalVideoUrl,
      order_index: lessons.filter(l => l.module_id === selectedModuleId).length
    });

    setUploadProgress(100);

    if (error) toast.error("Erro ao criar aula");
    else {
      toast.success("Aula adicionada e salva no banco!");
      setLessonTitle("");
      setLessonContent("");
      setUploadingFile(null);
      setIsLessonModalOpen(false);
      setUploadProgress(0);
      fetchContent();
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Gerenciador de Aulas</h3>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setIsModuleModalOpen(true)}
             className="px-4 py-2 border border-border rounded-xl text-sm font-bold hover:bg-accent transition-colors flex items-center gap-1.5"
           >
             <span className="material-symbols-outlined text-lg">folder_open</span>
             Novo Módulo
           </button>
           <button 
             onClick={() => {
                if (modules.length === 0) return toast.error("Crie um módulo primeiro!");
                setSelectedModuleId(modules[0].id);
                setIsLessonModalOpen(true);
             }}
             className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-md flex items-center gap-1.5"
           >
             <span className="material-symbols-outlined text-lg">play_circle</span>
             Nova Aula (Vídeo)
           </button>
        </div>
      </div>

      {loading ? (
         <div className="py-12 flex justify-center"><div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full"/></div>
      ) : modules.length === 0 ? (
         <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            <span className="material-symbols-outlined text-4xl mb-2">folder_off</span>
            <p>Nenhum módulo cadastrado.<br/>Comece adicionando seu primeiro módulo.</p>
         </div>
      ) : (
         <div className="space-y-4">
            {modules.map((mod) => (
               <div key={mod.id} className="border border-border rounded-xl overflow-hidden">
                  <div className="bg-accent/50 px-5 py-4 flex justify-between items-center border-b border-border">
                     <h4 className="font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-muted-foreground text-sm">drag_indicator</span>
                        {mod.title}
                     </h4>
                     <button onClick={() => { setSelectedModuleId(mod.id); setIsLessonModalOpen(true); }} className="text-xs font-bold text-primary hover:underline">
                        + Add Aula
                     </button>
                  </div>
                  <div className="divide-y divide-border">
                     {lessons.filter(l => l.module_id === mod.id).map(lesson => (
                        <div key={lesson.id} className="pl-12 pr-5 py-3 flex justify-between items-center hover:bg-accent/30 transition-colors">
                           <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${lesson.video_url ? 'text-[hsl(var(--success))] filled-icon' : 'text-muted-foreground'}`}>
                                 {lesson.video_url ? 'not_started' : 'article'}
                              </span>
                               <span className="text-sm font-medium">{lesson.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <button onClick={() => setSelectedLessonForChallenge(lesson.id)} className="px-3 py-1 bg-primary/10 text-primary text-[11px] font-bold rounded-lg hover:bg-primary/20 flex items-center gap-1.5 transition-colors">
                                  <span className="material-symbols-outlined text-[13px] filled-icon">joystick</span> Desafio (Black Mirror)
                               </button>
                               <button className="text-muted-foreground hover:text-foreground text-sm p-1 ml-2">Editar</button>
                            </div>
                         </div>
                      ))}
                     {lessons.filter(l => l.module_id === mod.id).length === 0 && (
                        <div className="pl-12 pr-5 py-4 text-xs text-muted-foreground italic">Nenhuma aula neste módulo.</div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* New Module Modal */}
      {isModuleModalOpen && (
         <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4">Novo Módulo</h3>
            <form onSubmit={handleCreateModule} className="space-y-4">
              <input type="text" value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="Ex: Módulo 1 - Introdução" className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:border-primary transition-all" autoFocus required />
              <div className="flex justify-end gap-2">
                 <button type="button" onClick={() => setIsModuleModalOpen(false)} className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl">Cancelar</button>
                 <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm">Salvar Módulo</button>
              </div>
            </form>
          </div>
         </div>
      )}

      {/* New Lesson Modal with UPLOAD */}
      {isLessonModalOpen && (
         <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4">Nova Aula de Vídeo</h3>
            <form onSubmit={handleCreateLesson} className="space-y-4">
              <div>
                 <label className="text-xs font-bold mb-1 block">Pertence ao Módulo:</label>
                 <select value={selectedModuleId || ""} onChange={(e) => setSelectedModuleId(e.target.value)} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm">
                    {modules.map(m => (<option key={m.id} value={m.id}>{m.title}</option>))}
                 </select>
              </div>
              <div>
                 <label className="text-xs font-bold mb-1 block">Título da Aula</label>
                 <input type="text" value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="Ex: Aula 01 - Primeiros passos" className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:border-primary transition-all text-sm" required />
              </div>
              
              <div>
                 <label className="text-xs font-bold mb-1 block flex items-center justify-between">
                    Anexar Arquivo de Vídeo (Obrigatório para vídeo aulas)
                 </label>
                 <div className="border border-dashed border-primary/50 bg-primary/5 rounded-xl p-4 flex flex-col justify-center items-center text-center cursor-pointer relative hover:bg-primary/10 transition-colors">
                    <input type="file" accept="video/mp4,video/webm" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setUploadingFile(e.target.files?.[0] || null)} />
                    {uploadingFile ? (
                       <>
                          <span className="material-symbols-outlined text-[hsl(var(--success))] text-2xl mb-1">check_circle</span>
                          <span className="text-sm font-bold text-foreground">Arquivo Selecionado</span>
                          <span className="text-xs text-muted-foreground">{uploadingFile.name} ({(uploadingFile.size / (1024*1024)).toFixed(2)} MB)</span>
                       </>
                    ) : (
                       <>
                          <span className="material-symbols-outlined text-primary text-3xl mb-2">cloud_upload</span>
                          <span className="text-sm font-bold text-primary">Clique ou arraste um vídeo MP4</span>
                          <span className="text-xs text-muted-foreground mt-1">Hospedagem nativa ultrarrápida</span>
                       </>
                    )}
                 </div>
              </div>

              {uploadProgress > 0 && (
                 <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-primary"><span>Fazendo upload...</span><span>{uploadProgress}%</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                       <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                 </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                 <button type="button" onClick={() => { setIsLessonModalOpen(false); setUploadingFile(null); }} className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl" disabled={uploadProgress > 0}>Cancelar</button>
                 <button type="submit" disabled={uploadProgress > 0 || !lessonTitle.trim()} className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm disabled:opacity-50">
                    {uploadProgress > 0 ? 'Enviando p/ Nuvem...' : 'Salvar Aula e Adicionar'}
                 </button>
              </div>
            </form>
          </div>
         </div>
      )}

      {/* Challenge Editor Modal */}
      {selectedLessonForChallenge && (
         <ChallengeEditor 
            lessonId={selectedLessonForChallenge} 
            onClose={() => setSelectedLessonForChallenge(null)} 
         />
      )}
    </div>
  );
}
