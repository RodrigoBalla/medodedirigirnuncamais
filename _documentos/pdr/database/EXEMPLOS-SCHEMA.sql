-- =====================================================
-- AREA DE MEMBROS — SCHEMA SQL DE REFERÊNCIA
-- =====================================================
-- Este SQL roda do zero num Supabase novo. Execute em ordem.
-- Adapte nomes/tipos conforme seu programa.
-- =====================================================

-- =====================================================
-- 0. EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. ENUMS & TYPES
-- =====================================================
CREATE TYPE task_validation_type AS ENUM ('self_check', 'evidence_required', 'cs_validation');
CREATE TYPE user_state_type AS ENUM ('active', 'delayed', 'stuck', 'inactive', 'accelerated');
CREATE TYPE help_request_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE stack_phase AS ENUM ('base', 'implementacao', 'execucao');
CREATE TYPE community_channel AS ENUM ('geral', 'duvidas_tecnicas', 'mostrar_projetos', 'wins_conquistas', 'novidades');

-- =====================================================
-- 2. UTIL FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- =====================================================
-- 3. PROFILES (extension de auth.users)
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  whatsapp TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger pra criar profile auto após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 4. ORGANIZATIONS
-- =====================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium', 'enterprise')),
  seats_limit INT NOT NULL DEFAULT 1,
  contract_start DATE,
  contract_end DATE,
  billing_contact_name TEXT,
  billing_contact_email TEXT,
  billing_contact_phone TEXT,
  logo_url TEXT,
  notes TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('sponsor', 'executor', 'viewer')),
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id, status);
CREATE INDEX idx_org_members_org_status ON organization_members(organization_id, status);

CREATE TABLE organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'executor' CHECK (role IN ('sponsor', 'executor', 'viewer')),
  job_title TEXT,
  invited_by UUID REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_token ON organization_invites(token);
CREATE INDEX idx_invites_email_pending ON organization_invites(email) WHERE accepted_at IS NULL;

-- =====================================================
-- 5. RLS HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.current_user_orgs()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_orgs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =====================================================
-- 6. ONBOARDING
-- =====================================================
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'approved')),
  current_step INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,

  contact_name TEXT, contact_whatsapp TEXT, contact_email TEXT,
  company_name TEXT, business_description TEXT, website TEXT, instagram TEXT,
  segment TEXT, employee_count INT, revenue_range TEXT,

  why_now TEXT, main_bottleneck TEXT, goal_30_days TEXT, goal_90_days TEXT,

  lead_sources TEXT[], sales_channels TEXT[], crm_tool TEXT, whatsapp_type TEXT,
  uses_spreadsheets BOOLEAN, erp_tool TEXT, support_tool TEXT,

  executor_type TEXT, ai_familiarity INT,
  available_hours_per_week INT, preferred_schedule TEXT,
  execution_start_date DATE, milestone_dates JSONB DEFAULT '{}',
  accelerator_slug TEXT,

  additional_notes TEXT, team_members JSONB,
  approved_at TIMESTAMPTZ, approved_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON onboarding_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 7. JOURNEYS
-- =====================================================
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

CREATE INDEX idx_journeys_org ON user_journeys(organization_id, is_active);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_journeys FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
CREATE TRIGGER set_updated_at BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

CREATE INDEX idx_tasks_mission_order ON mission_tasks(mission_id, order_index);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mission_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE journey_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journey_id, project_id)
);

CREATE INDEX idx_journey_tracks ON journey_tracks(journey_id, order_index);

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

CREATE INDEX idx_stack_journey_phase ON journey_stack_tools(journey_id, phase, order_index);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON journey_stack_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: cria 4 stack tools default ao criar journey
CREATE OR REPLACE FUNCTION insert_default_stack_tools()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO journey_stack_tools (journey_id, name, description, url, phase, order_index, added_by)
  VALUES
    (NEW.id, 'Claude Code', 'Ferramenta de desenvolvimento com IA', 'https://claude.ai/download', 'base', 0, 'system'),
    (NEW.id, 'Supabase', 'Banco e autenticação', 'https://supabase.com', 'base', 1, 'system'),
    (NEW.id, 'GitHub', 'Repositório', 'https://github.com', 'base', 2, 'system'),
    (NEW.id, 'Vercel', 'Deploy', 'https://vercel.com', 'base', 3, 'system');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_default_stack AFTER INSERT ON user_journeys
  FOR EACH ROW EXECUTE FUNCTION insert_default_stack_tools();

CREATE TABLE journey_accelerators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  accelerator_slug TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  added_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journey_accelerators ON journey_accelerators(journey_id);

CREATE TABLE execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL UNIQUE REFERENCES user_journeys(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  target_end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON execution_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 8. CONTEÚDO (projects + lessons)
-- =====================================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  hero_image TEXT,
  thumbnail TEXT,
  difficulty TEXT,
  estimated_time TEXT,
  category TEXT,
  funnel_stage TEXT,
  display_in TEXT,
  total_lessons INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  what_you_will_learn JSONB,
  prerequisites JSONB,
  tools_used JSONB,
  target_audience TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  module_name TEXT,
  module_order INT,
  order_index INT NOT NULL DEFAULT 1,
  duration TEXT NOT NULL,
  video_url TEXT,
  thumbnail TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  assemblyai_transcript_id TEXT,
  transcript TEXT,
  ai_materials_status TEXT DEFAULT 'pending',
  supplementary_materials JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_project ON lessons(project_id, module_order, order_index);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE lesson_ai_materials (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  summary_text TEXT,
  steps_json JSONB DEFAULT '[]'::jsonb,
  faqs_json JSONB DEFAULT '[]'::jsonb,
  checklist_json JSONB DEFAULT '[]'::jsonb,
  mindmap_json JSONB DEFAULT '{}'::jsonb,
  code_snippets_json JSONB DEFAULT '[]'::jsonb,
  useful_links_json JSONB DEFAULT '[]'::jsonb,
  common_issues_json JSONB DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lesson_ai_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_timestamp INT NOT NULL DEFAULT 0,
  watch_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_progress_user_lesson ON user_lesson_progress(user_id, lesson_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_lesson_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 9. ACCELERATORS
-- =====================================================
CREATE TABLE accelerators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  long_description TEXT,
  type TEXT,
  difficulty TEXT,
  setup_time TEXT,
  category TEXT,
  thumbnail TEXT,
  screenshots JSONB,
  video_url TEXT,
  stack JSONB,
  features JSONB,
  prerequisites JSONB,
  installation_guide TEXT,
  documentation TEXT,
  troubleshooting TEXT,
  env_example TEXT,
  sql_migrations TEXT,
  download_url TEXT,
  lovable_remix_url TEXT,
  import_methods JSONB,
  related_project_id TEXT REFERENCES projects(id),
  tags JSONB,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  download_count INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accelerators FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 10. RLS — Habilitar e aplicar policies (resumido)
-- =====================================================
-- Aplique padrões em TODAS as tabelas. Veja RLS-PADRAO.md.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_stack_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_accelerators ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_ai_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE accelerators ENABLE ROW LEVEL SECURITY;

-- Exemplos de policies (criar pra cada tabela):
CREATE POLICY "Members view own org" ON organizations FOR SELECT USING (id IN (SELECT current_user_orgs()));
CREATE POLICY "Admins manage all orgs" ON organizations FOR ALL USING (is_admin());

CREATE POLICY "Authenticated view content" ON projects FOR SELECT USING (auth.role() = 'authenticated' AND is_published = true);
CREATE POLICY "Admins manage projects" ON projects FOR ALL USING (is_admin());

CREATE POLICY "Authenticated view lessons" ON lessons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage lessons" ON lessons FOR ALL USING (is_admin());

CREATE POLICY "Members view journey" ON user_journeys FOR SELECT USING (organization_id IN (SELECT current_user_orgs()));
CREATE POLICY "Admins manage journeys" ON user_journeys FOR ALL USING (is_admin());

-- ... continuar pra cada tabela (ver RLS-PADRAO.md)

-- =====================================================
-- FIM
-- =====================================================
-- Próximos passos:
-- 1. Aplicar policies em TODAS as tabelas (RLS-PADRAO.md)
-- 2. Criar tabelas de community, encontros, chat, admin (não inclusas aqui — ver módulos)
-- 3. Configurar Edge Functions (modules/13-INTEGRACOES.md)
