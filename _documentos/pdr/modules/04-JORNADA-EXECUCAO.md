# Módulo 04 — Jornada de Execução ⭐

> **Coração do produto.** Onde o aluno passa 80% do tempo. Define o que ele faz cada dia, semana, mês.

## Visão

```
Página /minha-jornada — layout
┌──────────────────────────────────────────────┐
│  [Header: Saudação + countdown + equipe]    │
├──────────────────────────────────────────────┤
│  [Goals Panel: meta 30d, 90d, gargalo]      │
├──────────────────────────────────────────────┤
│  [Weekly Review: plano da semana — 1x/sem]  │
├──────────────────────────────────────────────┤
│  [Roadmap horizontal de 7 etapas]           │
│   ✅ Onboarding → ▶️ Starter → 🔒 Builder ... │
├──────────────────────────────────────────────┤
│  [Step Atual em destaque (imagem + CTA)]    │
├──────────────────────────────────────────────┤
│  [Bento grid: tasks + stack + vitórias + cs]│
└──────────────────────────────────────────────┘
```

## As 7 etapas (estrutura fixa)

A estrutura é igual pra todo aluno; o **conteúdo** muda baseado no onboarding.

| # | Etapa | Tasks típicas | Validação | Deadline padrão |
|:-:|---|---|---|:-:|
| 0 | Onboarding | "Realizar call de onboarding", "Definir objetivo e cronograma" | `cs_validation` | dia 0 |
| 1 | Fundamentos | "Concluir aulas do módulo Starter" | `self_check` (sync com aulas) | dia +7 |
| 2 | Builder | "Concluir aulas Builder", "Configurar stacks necessárias" | `self_check` | dia +10 |
| 3 | Call de Implementação | "Agendar call com Suporte", "Definir aceleradores", "Definir stacks" | `cs_validation` | dia +12 |
| 4 | Acelerador | "Baixar Acelerador X", "Concluir aulas do módulo X", "Iniciar implementação" | `self_check` | dia +22 |
| 5 | Implementação | "Base implementada", "Testar com dados reais", "Ajustar com base nos testes", "Validar com suporte" | `evidence_required` + `cs_validation` | dia +27 |
| 6 | Meta | "Ativar agente em produção", "Monitorar 3 dias", "Apresentar resultados" | `evidence_required` + `cs_validation` | dia +30 |

## Schemas

### `user_journeys`

```sql
CREATE TABLE user_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  phase TEXT DEFAULT 'welcome' CHECK (phase IN ('welcome', 'learning', 'implementing', 'testing', 'production')),
  current_step_id TEXT,
  started_at TIMESTAMPTZ,
  target_end_date DATE,
  cs_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `missions` (cada uma das 7 etapas vira uma mission)

```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  objective TEXT,
  expected_outcome TEXT,
  completion_criteria TEXT,
  order_index INT NOT NULL DEFAULT 0,
  deadline DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_missions_journey_order ON missions(journey_id, order_index);
```

### `mission_tasks`

```sql
CREATE TYPE task_validation_type AS ENUM ('self_check', 'evidence_required', 'cs_validation');

CREATE TABLE mission_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  validation_type task_validation_type NOT NULL DEFAULT 'self_check',
  order_index INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  evidence_url TEXT,
  evidence_note TEXT,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `journey_tracks` (vincula trilhas/projetos à jornada)

```sql
CREATE TABLE journey_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journey_id, project_id)
);

CREATE INDEX idx_journey_tracks ON journey_tracks(journey_id, order_index);
```

⚠️ **Sempre defina `order_index` distinto** (não múltiplos com 0). Senão Postgres cai em ordem alfabética e Builder aparece antes de Starter (b < s). Bug clássico em `aprendizados/BUGS-CLASSICOS.md`.

### `journey_stack_tools` (ferramentas progressivas)

```sql
CREATE TYPE stack_phase AS ENUM ('base', 'implementacao', 'execucao');

CREATE TABLE journey_stack_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  phase stack_phase NOT NULL DEFAULT 'base',
  order_index INT NOT NULL DEFAULT 0,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  added_by TEXT NOT NULL DEFAULT 'system',
  added_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `journey_accelerators` (aceleradores vinculados)

```sql
CREATE TABLE journey_accelerators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  accelerator_slug TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  added_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Trigger automático de stack tools default

Quando uma `user_journey` é criada, criar 4 stack tools de base automaticamente:

```sql
CREATE FUNCTION insert_default_stack_tools()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO journey_stack_tools (journey_id, name, description, url, phase, order_index, added_by)
  VALUES
    (NEW.id, 'Claude Code', 'Ferramenta de desenvolvimento com IA', 'https://claude.ai/download', 'base', 0, 'system'),
    (NEW.id, 'Supabase', 'Banco de dados e autenticação', 'https://supabase.com', 'base', 1, 'system'),
    (NEW.id, 'GitHub', 'Repositório de código', 'https://github.com', 'base', 2, 'system'),
    (NEW.id, 'Vercel', 'Deploy e hospedagem', 'https://vercel.com', 'base', 3, 'system');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_insert_default_stack
  AFTER INSERT ON user_journeys
  FOR EACH ROW EXECUTE FUNCTION insert_default_stack_tools();
```

## Auto-geração de missions (alunos antigos OU novos)

Função client-side que gera as 7 missions baseado no onboarding. Roda quando o aluno acessa `/minha-jornada` e tem journey com `< 6` missions.

```typescript
async function generateV3Missions(journeyId: string, organizationId: string) {
  const { data: ob } = await supabase.from('onboarding_sessions').select('*').eq('organization_id', organizationId).single();
  const { data: tracks } = await supabase.from('journey_tracks').select('project_id, projects(title)').eq('journey_id', journeyId).order('order_index');
  
  const goal30 = ob?.goal_30_days || 'Agente de IA rodando';
  const startDate = new Date(ob?.execution_start_date || Date.now());
  const endDate = new Date(startDate.getTime() + 30 * 86400000);
  const milestones = ob?.milestone_dates || {};
  const getDate = (key: string, days: number) => milestones[key] || new Date(startDate.getTime() + days * 86400000).toISOString().split('T')[0];
  
  // Tracks fixas vs aceleradores
  const fixedTracks = ['starter', 'builder'];
  const accelTracks = (tracks || []).filter(t => !fixedTracks.includes(t.project_id));
  
  // Tasks de aceleradores (dinâmicas)
  const accelTasks = [];
  if (accelTracks.length > 0) {
    accelTracks.forEach((track, i) => {
      accelTasks.push({ title: `Concluir aulas do módulo ${track.projects.title}`, validation_type: 'self_check', order_index: i*2 });
      accelTasks.push({ title: `Baixar Acelerador ${track.projects.title}`, validation_type: 'self_check', order_index: i*2+1 });
    });
    accelTasks.push({ title: 'Iniciar implementação do projeto', validation_type: 'self_check', order_index: accelTasks.length });
  } else {
    accelTasks.push({ title: 'Baixar Acelerador', validation_type: 'self_check', order_index: 0 });
    accelTasks.push({ title: 'Iniciar implementação do projeto', validation_type: 'self_check', order_index: 1 });
  }
  
  const missions = [
    {
      title: 'Onboarding', objective: 'Definir o plano de execução', order_index: 0,
      deadline: startDate.toISOString().split('T')[0],
      started_at: startDate.toISOString(), completed_at: startDate.toISOString(),
      tasks: [
        { title: 'Realizar call de onboarding', validation_type: 'cs_validation', order_index: 0, completed_at: startDate.toISOString() },
        { title: 'Definir objetivo e cronograma', validation_type: 'self_check', order_index: 1, completed_at: startDate.toISOString() },
      ],
    },
    {
      title: 'Starter', objective: 'Concluir o módulo Starter', order_index: 1,
      deadline: getDate('starter', 7),
      tasks: [{ title: 'Concluir aulas do módulo Starter', validation_type: 'self_check', order_index: 0 }],
    },
    {
      title: 'Builder', objective: 'Concluir o módulo Builder e configurar stacks', order_index: 2,
      deadline: getDate('builder', 10),
      tasks: [
        { title: 'Concluir aulas do módulo Builder', validation_type: 'self_check', order_index: 0 },
        { title: 'Configurar as stacks necessárias', validation_type: 'self_check', order_index: 1 },
      ],
    },
    {
      title: 'Call de Implementação', objective: 'Revisar progresso e alinhar próximos passos', order_index: 3,
      deadline: getDate('call', 12),
      tasks: [
        { title: 'Agendar call com Suporte', validation_type: 'self_check', order_index: 0 },
        { title: 'Definir aceleradores do projeto', validation_type: 'cs_validation', order_index: 1 },
        { title: 'Definir stacks com Suporte', validation_type: 'cs_validation', order_index: 2 },
      ],
    },
    {
      title: accelTracks.length > 1 ? 'Aceleradores' : 'Acelerador + Implementação',
      objective: 'Baixar acelerador e iniciar implementação',
      order_index: 4,
      deadline: getDate('acelerador', 22),
      tasks: accelTasks,
    },
    {
      title: 'Implementação', objective: 'Implementar, testar e validar', order_index: 5,
      deadline: getDate('implementacao', 27),
      tasks: [
        { title: 'Base implementada do projeto', validation_type: 'evidence_required', order_index: 0 },
        { title: 'Testar com dados reais', validation_type: 'self_check', order_index: 1 },
        { title: 'Ajustar com base nos testes', validation_type: 'self_check', order_index: 2 },
        { title: 'Validar com suporte técnico', validation_type: 'cs_validation', order_index: 3 },
      ],
    },
    {
      title: goal30, objective: 'Agente ativo em produção', order_index: 6,
      deadline: endDate.toISOString().split('T')[0],
      tasks: [
        { title: 'Ativar agente em produção', validation_type: 'evidence_required', order_index: 0 },
        { title: 'Monitorar por 3 dias', validation_type: 'self_check', order_index: 1 },
        { title: 'Apresentar resultados', validation_type: 'cs_validation', order_index: 2 },
      ],
    },
  ];
  
  for (const mission of missions) {
    const { tasks, ...missionData } = mission;
    const { data: created } = await supabase.from('missions').insert({ ...missionData, journey_id: journeyId }).select('id').single();
    if (created && tasks.length > 0) {
      await supabase.from('mission_tasks').insert(tasks.map(t => ({ ...t, mission_id: created.id })));
    }
  }
  
  await supabase.from('user_journeys').update({
    started_at: startDate.toISOString(),
    target_end_date: endDate.toISOString().split('T')[0],
    phase: 'learning',
    description: goal30,
  }).eq('id', journeyId);
}
```

## Gates condicionais

Cada etapa só desbloqueia quando a anterior estiver completa:

```typescript
function isStepUnlocked(stepIndex: number, missions: Mission[]): boolean {
  if (stepIndex === 0) return true; // Onboarding sempre aberto
  return !!missions[stepIndex - 1]?.completed_at;
}
```

UI mostra:
- ✅ Concluído (cinza claro, checkmark verde)
- ▶️ Atual (destaque, glow)
- 🔒 Bloqueado (mais escuro, ícone de cadeado)
- 🎯 Meta (último step, ícone troféu)

## Auto-completar mission

Quando todas as tasks de uma mission estão completas, a mission auto-completa:

```typescript
async function updateTaskStatus(taskId: string, completed: boolean) {
  const { data: task } = await supabase
    .from('mission_tasks')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', taskId).select('mission_id').single();
  
  // Verifica se TODAS as tasks da mission estão completas
  const { data: tasks } = await supabase
    .from('mission_tasks')
    .select('completed_at')
    .eq('mission_id', task.mission_id);
  
  const allComplete = tasks.every(t => t.completed_at !== null);
  const someIncomplete = tasks.some(t => t.completed_at === null);
  
  if (allComplete) {
    // Auto-completa mission
    await supabase.from('missions').update({ completed_at: new Date().toISOString() }).eq('id', task.mission_id);
  } else if (someIncomplete) {
    // Re-abre mission (caso aluno desmarque task)
    await supabase.from('missions').update({ completed_at: null }).eq('id', task.mission_id);
  }
}
```

## Sync automático aulas ↔ tasks

Quando aluno completa aulas do Starter, a task "Concluir aulas do módulo Starter" auto-marca:

```typescript
async function syncLessonProgressWithTasks(userId: string, journeyId: string) {
  const { data: tracks } = await supabase.from('journey_tracks').select('project_id').eq('journey_id', journeyId);
  const projectIds = tracks?.map(t => t.project_id) || [];
  
  for (const projectId of projectIds) {
    const { count: total } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
    const { count: completed } = await supabase.from('user_lesson_progress').select('lesson_id, lessons!inner(project_id)', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true).eq('lessons.project_id', projectId);
    
    const allComplete = total && completed === total;
    
    // Encontra task que menciona esse módulo
    const projectTitle = projectId === 'starter' ? 'Starter' : projectId === 'builder' ? 'Builder' : projectId;
    const { data: matchingTask } = await supabase.from('mission_tasks')
      .select('id, completed_at, mission:missions!inner(journey_id)')
      .ilike('title', `%${projectTitle}%`)
      .eq('mission.journey_id', journeyId)
      .maybeSingle();
    
    if (matchingTask) {
      if (allComplete && !matchingTask.completed_at) {
        await supabase.from('mission_tasks').update({ completed_at: new Date().toISOString() }).eq('id', matchingTask.id);
      }
    }
  }
}
```

Roda no hook `useJourneyData` toda vez que carrega.

## Stack Tools por fase

Stack tools são adicionadas progressivamente:

- **`base`** (criadas automaticamente ao criar journey): Claude Code, Supabase, GitHub, Vercel
- **`implementacao`** (CS adiciona durante a call de implementação): Stripe, UAZAPI, Resend, etc — específicas pra cada projeto
- **`execucao`** (Suporte adiciona se aluno precisar): Sentry, Logflare, etc

Aluno pode marcar checkbox em cada tool quando configurar.

## Botões de contato com humano

Em cada step, mostra botão pra falar com a pessoa relevante:

```tsx
<CsContactButton 
  contact={step.helpContact === 'cs' ? simoneCS : luizTech}
  reason={`Travado em: ${step.title}`}
/>
```

Click → `request-cs-contact` ou `request-support-call` → notifica grupo certo no WhatsApp.

## Visão da Semana (WeeklyReview)

Card que aparece **1x por semana** mostrando plano calculado:

```typescript
function calculateWeeklyPlan(availableHours: number, currentMission: Mission): WeeklyPlan {
  const remainingTasks = currentMission.tasks.filter(t => !t.completed_at);
  const estimatedHoursPerTask = 1.5; // ajustar por tipo
  const tasksPerWeek = Math.floor(availableHours / estimatedHoursPerTask);
  
  return {
    focusMission: currentMission.title,
    suggestedTasks: remainingTasks.slice(0, tasksPerWeek),
    totalHours: tasksPerWeek * estimatedHoursPerTask,
  };
}
```

Aparece se: `last_week_review_dismissed_at < 7 dias atrás` (controle via localStorage).

## Phase do journey

`user_journeys.phase` muda conforme aluno progride:

| Phase | Quando |
|---|---|
| `welcome` | Recém criado, antes de qualquer mission começar |
| `learning` | Em Starter ou Builder |
| `implementing` | Em Acelerador ou Implementação |
| `testing` | Validando |
| `production` | Meta concluída |

Atualizado por trigger ou cron.

## Componentes principais

```
src/components/journey/
├── JourneyHeader.tsx          # Saudação + countdown + equipe
├── GoalsPanel.tsx             # Meta 30d/90d/gargalo
├── WeeklyReview.tsx           # Plano da semana
├── JourneyRoadmap.tsx         # Horizontal de 7 etapas
├── JourneyCurrentStep.tsx     # Card grande do step atual
├── JourneyBentoGrid.tsx       # Tasks + stack + vitórias + cs
├── ContextualNudge.tsx        # Frase motivacional contextual
├── StackPanel.tsx             # Lista de ferramentas
├── CsContactButton.tsx        # Botão padrão pra contato
└── CallRequestModal.tsx       # Modal de solicitar call
```

## RLS

```sql
-- Padrão pra todas as tabelas de jornada
CREATE POLICY "Members view journey" ON user_journeys FOR SELECT USING (organization_id IN (SELECT current_user_orgs()));
CREATE POLICY "Members view missions" ON missions FOR SELECT USING (
  journey_id IN (SELECT id FROM user_journeys WHERE organization_id IN (SELECT current_user_orgs()))
);
CREATE POLICY "Members view tasks" ON mission_tasks FOR SELECT USING (
  mission_id IN (SELECT id FROM missions WHERE journey_id IN (SELECT id FROM user_journeys WHERE organization_id IN (SELECT current_user_orgs())))
);
CREATE POLICY "Members update own tasks" ON mission_tasks FOR UPDATE USING (
  mission_id IN (SELECT id FROM missions WHERE journey_id IN (SELECT id FROM user_journeys WHERE organization_id IN (SELECT current_user_orgs())))
);
-- Admins: ALL com is_admin
```

## Checklist

- [ ] Schemas: `user_journeys`, `missions`, `mission_tasks`, `journey_tracks`, `journey_stack_tools`, `journey_accelerators`
- [ ] Trigger `insert_default_stack_tools`
- [ ] Auto-geração `generateV3Missions` (cliente)
- [ ] Hook `useJourneyData` que detecta missions vazias e dispara
- [ ] Componentes journey/* funcionando
- [ ] Auto-completar mission quando todas tasks completas
- [ ] Sync aulas ↔ tasks rodando no fetch
- [ ] Gates condicionais funcionando
- [ ] WeeklyReview com controle de dismiss
- [ ] Botões CsContact + CallRequest

## Próximo

`05-CATALOGO-CONTEUDO.md` — trilhas, módulos, aulas, materiais IA.
