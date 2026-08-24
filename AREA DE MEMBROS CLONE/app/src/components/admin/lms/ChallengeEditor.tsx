import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LessonChallenge, ChallengeOption } from "@/types/lms";

interface Props {
  lessonId: string;
  onClose: () => void;
}

export function ChallengeEditor({ lessonId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<{ id?: string, text: string, isCorrect: boolean, videoUrl: string | null }[]>([
     { text: "", isCorrect: true, videoUrl: null },
     { text: "", isCorrect: false, videoUrl: null }
  ]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchChallenge();
  }, [lessonId]);

  async function fetchChallenge() {
    setLoading(true);
    // Fetch challenge
    const { data: challenge } = await supabase
       .from('lesson_challenges')
       .select('*')
       .eq('lesson_id', lessonId)
       .maybeSingle();

    if (challenge) {
       setChallengeId(challenge.id);
       setQuestionText(challenge.question_text);
       
       const { data: opts } = await supabase
          .from('challenge_options')
          .select('*')
          .eq('challenge_id', challenge.id)
          .order('created_at');
          
       if (opts && opts.length > 0) {
          setOptions(opts.map((o: any) => ({
             id: o.id,
             text: o.option_text,
             isCorrect: o.is_correct,
             videoUrl: o.destination_video_url
          })));
       }
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!questionText.trim()) return toast.error("A pergunta é obrigatória!");
    if (options.length < 2) return toast.error("Você precisa de pelo menos 2 opções.");
    const hasCorrect = options.some(o => o.isCorrect);
    if (!hasCorrect) return toast.error("Marque pelo menos uma opção como a Correta (Destino Verde)!");

    setLoading(true);
    let cid = challengeId;

    if (!cid) {
       const { data, error } = await supabase.from('lesson_challenges').insert({
          lesson_id: lessonId,
          question_text: questionText
       }).select().single();
       if (error) { toast.error("Erro ao salvar desafio"); setLoading(false); return; }
       cid = data.id;
       setChallengeId(cid);
    } else {
       await supabase.from('lesson_challenges').update({ question_text: questionText }).eq('id', cid);
    }

    // Upsert options (delete old ones first for simplicity if we are replacing)
    await supabase.from('challenge_options').delete().eq('challenge_id', cid);

    const newOpts = options.map(o => ({
       challenge_id: cid,
       option_text: o.text,
       is_correct: o.isCorrect,
       destination_video_url: o.isCorrect ? null : o.videoUrl
    }));

    const { error: optErr } = await supabase.from('challenge_options').insert(newOpts);
    
    if (optErr) toast.error("Erro ao salvar as respostas");
    else {
       toast.success("Desafio e Consequências salvos com sucesso!");
       onClose();
    }
    setLoading(false);
  }

  const handleVideoUpload = async (index: number, file: File) => {
     if (!file.type.includes('video')) return toast.error("Apenas vídeos MP4.");
     setUploadingIndex(index);
     
     try {
        const fileName = `${Date.now()}_dest_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { error } = await supabase.storage.from("course-videos").upload(fileName, file);
        if (error) throw error;

        const { data: publicUrlData } = supabase.storage.from("course-videos").getPublicUrl(fileName);
        
        const newOpts = [...options];
        newOpts[index].videoUrl = publicUrlData.publicUrl;
        setOptions(newOpts);
        toast.success("Vídeo do Destino Ruim enviado!");
     } catch (err) {
        toast.error("Falha no upload");
     } finally {
        setUploadingIndex(null);
     }
  };

  if (loading) return <div className="p-8 text-center animate-pulse font-bold text-primary">Carregando Matrix...</div>;

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
       <div className="bg-card border border-border rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95">
          <div className="sticky top-0 bg-card/90 backdrop-blur border-b border-border p-5 md:p-6 flex items-center justify-between z-10">
             <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">videogame_asset</span> 
                  Criador de Destinos (Bandersnatch)
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Configure o Desafio que aparecerá no final da aula.</p>
             </div>
             <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-accent border border-transparent hover:border-border transition-all">
                <span className="material-symbols-outlined">close</span>
             </button>
          </div>

          <div className="p-5 md:p-8 space-y-8">
             {/* Question Setup */}
             <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                   1. A Pergunta Mestra
                </label>
                <textarea 
                   rows={3} 
                   value={questionText}
                   onChange={e => setQuestionText(e.target.value)}
                   placeholder="Ex: O que você faz se um carro cortar a sua frente repentinamente?"
                   className="w-full bg-background border border-border p-4 rounded-xl focus:border-primary resize-none"
                />
             </div>

             {/* Options Setup */}
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <label className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      2. Linhas do Tempo (Opções & Destinos)
                   </label>
                   <button 
                     onClick={() => setOptions([...options, { text: "", isCorrect: false, videoUrl: null }])}
                     className="text-xs font-bold text-primary hover:underline"
                   >
                      + Nova Opção
                   </button>
                </div>

                <div className="space-y-4">
                   {options.map((opt, idx) => (
                      <div key={idx} className={`p-5 rounded-2xl border-2 transition-all ${opt.isCorrect ? 'border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)]' : 'border-destructive/30 bg-destructive/5'}`}>
                         <div className="flex items-start gap-4">
                            <button 
                              onClick={() => {
                                 const newOpts = [...options];
                                 newOpts.forEach(o => o.isCorrect = false);
                                 newOpts[idx].isCorrect = true;
                                 setOptions(newOpts);
                              }}
                              className={`mt-1 size-6 shrink-0 rounded-full flex items-center justify-center border-2 transition-colors ${opt.isCorrect ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white' : 'border-muted-foreground bg-transparent'}`}
                            >
                               {opt.isCorrect && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                            </button>
                            
                            <div className="flex-1 space-y-3">
                               <input 
                                  type="text"
                                  value={opt.text}
                                  onChange={e => {
                                     const newOpts = [...options];
                                     newOpts[idx].text = e.target.value;
                                     setOptions(newOpts);
                                  }}
                                  placeholder={opt.isCorrect ? "Digite a resposta CORRETA que salva o aluno." : "Digite a escolha RUIM (que dará colisão/erro)."}
                                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary"
                               />

                               {!opt.isCorrect && (
                                  <div className="mt-3 p-4 bg-background border border-destructive/20 rounded-xl relative overflow-hidden">
                                     <p className="text-xs font-bold uppercase tracking-wider text-destructive mb-2 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">movie</span>
                                        Vídeo de Punição (Consequência do Erro)
                                     </p>
                                     <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                                        Esse vídeo curto será exibido com uma música tensa de suspense quando o aluno errar, gastando 1 vida dele.
                                     </p>

                                     {opt.videoUrl ? (
                                        <div className="flex items-center justify-between bg-accent p-3 rounded-lg">
                                           <span className="text-xs font-bold truncate text-foreground flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span> Vídeo Carregado Pronto!</span>
                                           <button onClick={() => { const o = [...options]; o[idx].videoUrl = null; setOptions(o); }} className="text-destructive text-xs hover:underline">Remover</button>
                                        </div>
                                     ) : (
                                        <div className="relative">
                                           <input 
                                              type="file" 
                                              accept="video/mp4" 
                                              onChange={(e) => { if(e.target.files?.[0]) handleVideoUpload(idx, e.target.files[0]) }}
                                              className="absolute inset-0 opacity-0 cursor-pointer"
                                              disabled={uploadingIndex === idx}
                                           />
                                           <div className={`border border-dashed border-destructive/30 rounded-lg p-3 text-center transition-colors ${uploadingIndex === idx ? 'bg-destructive/10' : 'hover:bg-destructive/10'}`}>
                                              <span className="text-xs font-bold text-destructive">
                                                {uploadingIndex === idx ? 'Enviando p/ Nuvem Supabase...' : '+ Adicionar MP4 (Reels/Destino)'}
                                              </span>
                                           </div>
                                        </div>
                                     )}
                                  </div>
                               )}
                            </div>

                            <button onClick={() => setOptions(options.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="sticky bottom-0 bg-card/90 backdrop-blur border-t border-border p-5 md:p-6 flex justify-end gap-3 z-10">
             <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-accent transition-colors">Cancelar Mutações</button>
             <button onClick={handleSave} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-xl shadow-primary/20 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">save</span>
                Salvar Linhas do Tempo
             </button>
          </div>
       </div>
    </div>
  );
}
