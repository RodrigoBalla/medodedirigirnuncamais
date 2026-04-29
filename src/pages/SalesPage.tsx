import React from "react";
import { useNavigate } from "react-router-dom";

const WHATSAPP_LINK = "https://wa.me/5511999999999?text=Oi!%20Quero%20saber%20mais%20sobre%20o%20curso%20Medo%20de%20Dirigir%20Nunca%20Mais.";

export default function SalesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white font-sans selection:bg-primary/30">
      
      {/* TOP BAR */}
      <div className="bg-primary/10 border-b border-primary/20 py-2 px-4 text-center text-xs md:text-sm font-medium text-primary-foreground tracking-wide flex justify-center items-center gap-2">
        <span className="material-symbols-outlined text-[16px]">verified_user</span>
        Compra 100% segura · Acesso Imediato · Garantia de 7 dias
      </div>

      {/* HERO SECTION */}
      <section className="relative px-6 py-20 md:py-32 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/20 via-[#0A0F1E] to-[#0A0F1E] -z-10"></div>
        
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-sm font-medium text-white/80">O fim do seu bloqueio ao volante</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl leading-tight mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
          Você tem CNH, mas o <span className="text-primary border-b-4 border-primary/40 pb-1">medo trava</span> você na hora de dirigir?
        </h1>
        
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-12">
          Descubra o método validado que já ajudou centenas de alunos a assumirem o controle da própria vida e do volante. Sem teorias chatas, apenas aplicação imediata e resultado real.
        </p>

        <a 
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-primary rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(var(--primary),0.4)]"
        >
          <div className="absolute inset-0 w-full h-full -x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out"></div>
          <span className="material-symbols-outlined mr-2">directions_car</span>
          QUERO VOLTAR A DIRIGIR AGORA
        </a>
      </section>

      {/* PAIN SECTION (DORES) */}
      <section className="px-6 py-24 bg-[#050810] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Se você tem medo de dirigir,<br/>já sentiu isso:</h2>
            <p className="text-white/50 text-lg">Os 4 bloqueios que travam 9 em cada 10 motoristas habilitados.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <PainCard 
              icon="favorite" 
              title="Suor Frio e Pânico" 
              desc="Só de pensar em pegar a chave ou sentar no banco do motorista, o coração acelera e a ansiedade toma conta."
            />
            <PainCard 
              icon="hail" 
              title="Dependência de Terceiros" 
              desc="Precisa sempre pedir carona ou pagar por aplicativos de transporte, mesmo tendo um carro parado na garagem."
            />
            <PainCard 
              icon="school" 
              title="Aulas que Não Funcionaram" 
              desc="Já pagou por aulas para habilitados, focou na técnica, mas o bloqueio emocional continuou lá."
            />
            <PainCard 
              icon="mood_bad" 
              title="Sensação de Incapacidade" 
              desc="Vê todo mundo dirigindo naturalmente, conversando, e se sente incapaz de fazer o mesmo com naturalidade."
            />
          </div>
        </div>
      </section>

      {/* SOLUTION / PRODUCT SECTION */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="inline-block bg-primary/20 text-primary font-semibold px-3 py-1 rounded-full text-sm mb-6 border border-primary/30">
              A Solução Existe
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              Existe um caminho mais rápido para você assumir o volante.
            </h2>
            <p className="text-white/60 text-lg mb-8">
              A metodologia <strong>Medo de Dirigir Nunca Mais</strong> não é apenas um curso. É uma plataforma interativa e gamificada projetada para reprogramar a sua mente e construir confiança prática, passo a passo. Sem risco e no seu próprio ritmo.
            </p>
            
            <ul className="space-y-4 mb-8">
              <CheckItem text="Plataforma gamificada com recompensas (você ganha moedas ao evoluir)" />
              <CheckItem text="Módulos práticos em vídeo, direto ao ponto" />
              <CheckItem text="Comunidade exclusiva de apoio entre alunos" />
              <CheckItem text="Missões diárias para vencer o medo gradativamente" />
            </ul>

            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 font-bold text-[#0A0F1E] bg-white rounded-xl hover:bg-gray-200 transition-colors"
            >
              Falar com o Suporte
            </a>
          </div>
          
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-primary/30 blur-[100px] rounded-full"></div>
            <div className="relative border border-white/10 rounded-2xl p-2 bg-[#050810] shadow-2xl">
              {/* Mockup visual da plataforma */}
              <div className="rounded-xl overflow-hidden border border-white/5 bg-[#0A0F1E] aspect-video flex flex-col">
                <div className="h-8 bg-black/40 border-b border-white/5 flex items-center px-3 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                </div>
                <div className="flex-1 p-6 flex flex-col justify-center items-center text-center">
                  <span className="material-symbols-outlined text-5xl text-primary mb-4 opacity-80">play_circle</span>
                  <div className="h-2 w-32 bg-white/10 rounded-full mb-2"></div>
                  <div className="h-2 w-24 bg-white/10 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OFFER & PRICING */}
      <section className="px-6 py-24 bg-gradient-to-b from-[#0A0F1E] to-[#050810] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-12">Tudo que você precisa por<br/>um valor acessível.</h2>
          
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground font-bold text-xs py-1 px-8 translate-x-8 translate-y-6 rotate-45 shadow-lg">
              ACESSO IMEDIATO
            </div>

            <div className="mb-8">
              <p className="text-white/50 uppercase tracking-wider font-semibold text-sm mb-2">Plano Único</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold text-white/50 line-through">R$ 297</span>
                <span className="text-6xl font-extrabold text-white">R$ 97</span>
              </div>
              <p className="text-primary font-medium mt-2">Pagamento único. Acesso total.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto mb-10">
              <CheckItem text="Acesso à Plataforma Gamificada" />
              <CheckItem text="Todas as Trilhas Práticas" />
              <CheckItem text="Acesso à Comunidade VIP" />
              <CheckItem text="Suporte Direto" />
              <CheckItem text="Atualizações Futuras Inclusas" />
              <CheckItem text="Garantia Incondicional de 7 dias" />
            </div>

            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto inline-flex items-center justify-center px-12 py-5 font-bold text-lg text-white bg-primary rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(var(--primary),0.5)]"
            >
              SIM! EU QUERO MEU ACESSO
              <span className="material-symbols-outlined ml-2">arrow_forward</span>
            </a>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Pagamento 100% seguro. Seus dados estão protegidos.
            </div>
          </div>
        </div>
      </section>

      {/* GUARANTEE */}
      <section className="px-6 py-20 bg-[#050810]">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-8 bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 border border-primary/30">
            <span className="material-symbols-outlined text-4xl text-primary">gpp_good</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2">Risco Zero - Garantia de 7 Dias</h3>
            <p className="text-white/60">
              Se você entrar na plataforma, assistir às aulas e achar que o método não é para você, basta nos enviar um e-mail em até 7 dias que devolveremos 100% do seu dinheiro. Sem perguntas, sem burocracia.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-white/5 text-center text-white/30 text-sm">
        <p className="mb-4">© {new Date().getFullYear()} Medo de Dirigir Nunca Mais. Todos os direitos reservados.</p>
        <div className="flex justify-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
          <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contato</a>
        </div>
      </footer>

    </div>
  );
}

function PainCard({ title, desc, icon }: { title: string, desc: string, icon: string }) {
  return (
    <div className="bg-[#0A0F1E] border border-white/5 p-8 rounded-2xl transition-colors hover:border-white/10 hover:bg-white/[0.02]">
      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 border border-white/5">
        <span className="material-symbols-outlined text-primary">{icon}</span>
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-white/50 leading-relaxed">{desc}</p>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="material-symbols-outlined text-primary flex-shrink-0">check_circle</span>
      <span className="text-white/80">{text}</span>
    </li>
  );
}
