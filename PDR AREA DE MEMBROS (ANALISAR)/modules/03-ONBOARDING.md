# Módulo 03 — Onboarding Conversacional

> Coleta dados estratégicos do aluno em 5-10min e gera **jornada personalizada** automaticamente. Sem onboarding bom, jornada é genérica.

## Objetivo

Cada aluno preenche → IA processa → cria `user_journey` v3 com 7 etapas adaptadas ao perfil dele:
- Tracks (Starter, Builder, Acelerador escolhido)
- Stack tools sugeridas
- Deadlines realistas baseado em horas disponíveis
- Acelerador primário definido

## Fluxo UX

7 telas (uma por step). NÃO usar wizard de 1 página com todos os campos — overwhelm.

### Tela 1 — Empresa
- Nome da empresa (texto livre)
- Segmento (dropdown: SaaS, e-commerce, serviços, infoproduto, varejo, B2B, outro)
- Faturamento (faixas: até 50k/mês, 50k-200k, 200k-1M, 1M+)
- Site (opcional)

### Tela 2 — Equipe
- Quantos colaboradores? (1, 2-5, 6-20, 20+)
- Quem vai executar este programa? ("eu mesmo", "tenho dev no time", "vou contratar")
- Familiaridade com IA: 1-5

### Tela 3 — Objetivo de 30 dias
- Pergunta aberta: "O que você quer ter pronto em 30 dias?"
- Texto livre
- Validação: mínimo 20 caracteres

### Tela 4 — Objetivo de 90 dias
- Pergunta aberta: "E em 90 dias?"
- Texto livre

### Tela 5 — Gargalo principal
- Pergunta: "Qual é o maior gargalo do seu negócio hoje?"
- Texto livre + dropdown de categorias (Vendas, Atração, Operação, Conteúdo, Atendimento, Gestão)

### Tela 6 — Stack atual
- CRM em uso? (HubSpot / Pipedrive / planilha / nenhum)
- WhatsApp tipo? (oficial / API não-oficial / não usa)
- ERP? (livre)
- Ferramentas que já usa (multi-select de 20+ opções)

### Tela 7 — Disponibilidade
- Horas/semana disponíveis pra este programa: 1-3, 4-7, 8-15, 15+
- Horário preferido: manhã / tarde / noite
- Data de início: hoje, amanhã, próxima segunda

### Tela 8 — Resumo + confirmação
- IA gera 1 parágrafo: "Entendi. Você quer X, em Y semanas, com Z horas/semana. Vou montar uma jornada focada em A, B, C."
- Botão "Bora começar"
- Click → dispara `onboarding-webhook`

## Schema

```sql
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT 'main',
  token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'approved')),
  current_step INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  
  -- Empresa
  contact_name TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  company_name TEXT,
  business_description TEXT,
  website TEXT,
  instagram TEXT,
  segment TEXT,
  employee_count INT,
  revenue_range TEXT,
  
  -- Estratégia
  why_now TEXT,
  main_bottleneck TEXT,
  goal_30_days TEXT,
  goal_90_days TEXT,
  
  -- Stack
  lead_sources TEXT[],
  lead_sources_other TEXT,
  sales_channels TEXT[],
  sales_channels_other TEXT,
  crm_tool TEXT,
  whatsapp_type TEXT,
  uses_spreadsheets BOOLEAN,
  erp_tool TEXT,
  support_tool TEXT,
  data_locations TEXT[],
  data_quality TEXT,
  
  -- Operacional
  executor_type TEXT,
  ai_familiarity INT,
  available_hours_per_week INT,
  preferred_schedule TEXT,
  execution_start_date DATE,
  milestone_dates JSONB DEFAULT '{}',
  accelerator_slug TEXT,
  
  additional_notes TEXT,
  team_members JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Edge function `onboarding-webhook`

Roda quando aluno confirma a tela 8.

```typescript
serve(async (req) => {
  const { onboarding_id } = await req.json();
  
  const { data: ob } = await admin.from('onboarding_sessions').select('*').eq('id', onboarding_id).single();
  
  // 1. Marcar onboarding como completo
  await admin.from('onboarding_sessions').update({ 
    status: 'completed', 
    completed_at: new Date().toISOString() 
  }).eq('id', ob.id);
  
  // 2. Criar user_journey
  const { data: journey } = await admin.from('user_journeys').insert({
    organization_id: ob.organization_id,
    description: ob.goal_30_days,
    is_active: true,
    phase: 'welcome',
    started_at: new Date().toISOString(),
    target_end_date: ob.execution_start_date 
      ? new Date(new Date(ob.execution_start_date).getTime() + 30*86400000).toISOString().split('T')[0]
      : new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
  }).select().single();
  
  // 3. Adicionar tracks fixas (Starter sempre 0, Builder sempre 1)
  const tracks = [
    { project_id: 'starter', order_index: 0 },
    { project_id: 'builder', order_index: 1 },
  ];
  if (ob.accelerator_slug) {
    tracks.push({ project_id: ob.accelerator_slug, order_index: 2 });
  }
  await admin.from('journey_tracks').insert(
    tracks.map(t => ({ ...t, journey_id: journey.id }))
  );
  
  // 4. Disparar geração das missions (cliente client-side detecta < 6 missions e gera)
  // OU rodar generateV3Missions aqui no servidor
  
  // 5. Notificar CS via WhatsApp
  await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
    method: 'POST',
    body: JSON.stringify({
      group: 'cs',
      message: `🆕 Onboarding completo: ${ob.contact_name} (${ob.company_name})\nGargalo: ${ob.main_bottleneck}\nMeta 30d: ${ob.goal_30_days}`
    })
  });
  
  return new Response(JSON.stringify({ success: true, journey_id: journey.id }));
});
```

## IA gera resumo personalizado (Tela 8)

Após preencher Tela 7, antes de mostrar Tela 8, chama Gemini Flash:

```typescript
const prompt = `
Você é uma consultora de programa de aceleração. Gere um resumo curto (3 parágrafos) personalizado pra essa pessoa baseado no onboarding dela.

Dados:
- Nome: ${contact_name}
- Empresa: ${company_name} (${segment}, faturamento ${revenue_range})
- Meta 30 dias: ${goal_30_days}
- Meta 90 dias: ${goal_90_days}
- Gargalo: ${main_bottleneck}
- Horas/semana disponíveis: ${available_hours_per_week}
- Stack: CRM=${crm_tool}, WhatsApp=${whatsapp_type}

Gere:
1. Parágrafo 1: confirme que você entendeu o objetivo (1-2 frases)
2. Parágrafo 2: explique como o programa vai resolver o gargalo X (2-3 frases, mencionando módulos relevantes)
3. Parágrafo 3: definir compromisso de tempo (Y horas, em Z semanas)

Tom: humano, direto, motivador, sem clichês.
`;

const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
  method: 'POST',
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
});
```

## Auto-geração de jornada (alunos antigos)

Se aluno fez onboarding antigo (formato pré-v3, ex: tinha apenas `journey_objectives`), o sistema detecta ao acessar `/minha-jornada` e auto-gera as 7 etapas. Lógica completa em `04-JORNADA-EXECUCAO.md`.

## Tipo de pergunta — boas práticas

- **Texto livre quando possível** (mais info pra IA)
- **Multi-select com "outro"** pra stack tools
- **Faixas em vez de número exato** pra faturamento (cliente desconfia de pergunta direta)
- **NÃO pergunte CPF, CNPJ, dados sensíveis no onboarding** — coleta no checkout do gateway
- **NÃO pergunte mais de 30 campos** — fadiga

## Page logic

```tsx
// /onboarding
function Onboarding() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const { data: ob } = useOnboardingSession();
  
  // Carrega progresso anterior
  useEffect(() => {
    if (ob) { setStep(ob.current_step); setFormData(ob); }
  }, [ob]);
  
  async function handleNext(stepData: Partial<OnboardingData>) {
    const newData = { ...formData, ...stepData };
    setFormData(newData);
    
    // Salva parcial
    await supabase.from('onboarding_sessions').upsert({
      ...newData,
      organization_id: orgId,
      current_step: step + 1,
    });
    
    if (step === 7) {
      await supabase.functions.invoke('onboarding-webhook', { body: { onboarding_id: ob.id } });
      navigate('/minha-jornada');
    } else {
      setStep(step + 1);
    }
  }
  
  return (
    <OnboardingLayout step={step} totalSteps={8}>
      {step === 0 && <Step1Empresa onNext={handleNext} initial={formData} />}
      {step === 1 && <Step2Equipe onNext={handleNext} initial={formData} />}
      {/* ... */}
    </OnboardingLayout>
  );
}
```

## Gating de acesso

Aluno **não pode pular** o onboarding. Em `/minha-jornada`, se não tem `onboarding_sessions.completed_at`, redireciona pra `/onboarding`.

```tsx
function MinhaJornada() {
  const { data: ob } = useOnboardingSession();
  
  if (ob && !ob.completed_at) return <Navigate to="/onboarding" replace />;
  if (!ob) return <Navigate to="/onboarding" replace />;
  
  // ...
}
```

## Salvamento progressivo

Cada step salva parcial em `onboarding_sessions`. Aluno pode fechar o navegador e voltar — retoma de onde parou.

## RLS

```sql
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage own org onboarding" ON onboarding_sessions
  FOR ALL USING (organization_id IN (SELECT current_user_orgs()));

CREATE POLICY "Admins can manage all" ON onboarding_sessions
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

## Aprovação manual (opcional)

Em programas premium, admin precisa aprovar antes da jornada ativar. Edge function `approve-onboarding`:

```typescript
serve(async (req) => {
  const { onboarding_id } = await req.json();
  // Validar que requester é admin
  // Marca approved_at + approved_by
  // Dispara onboarding-webhook (que cria journey)
  // Notifica aluno via WhatsApp
});
```

Use `status='completed'` (auto) vs `status='approved'` (manual).

## Checklist

- [ ] Tabela `onboarding_sessions` com 30+ campos
- [ ] 8 telas funcionais com salvamento progressivo
- [ ] Tela 8 gera resumo via Gemini Flash
- [ ] Edge function `onboarding-webhook` cria journey + tracks
- [ ] Gating em `/minha-jornada` força onboarding completo
- [ ] RLS aplicado
- [ ] Notificação CS via WhatsApp ao concluir
- [ ] Auto-geração v3 pra alunos antigos (cobertura em `04-JORNADA-EXECUCAO.md`)

## Próximo

`04-JORNADA-EXECUCAO.md` — coração do produto: 7 etapas, tasks, gates.
