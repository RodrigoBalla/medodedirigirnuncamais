-- Reembolso de aluno (Balla 2026-07-30)
-- ─────────────────────────────────────────────────────────────────────────────
-- Marca as compras de um aluno como REEMBOLSADAS. Fonte de verdade: a coluna
-- enrolled_emails.refunded_at (a receita/lucro do painel de tráfego vem 100%
-- dessa tabela via notes->capi_val). Casamento aluno<->compra é por EMAIL.
--
-- Efeito escolhido pelo Balla: reembolso TAMBÉM expira o acesso
-- (profiles.access_status='expired'); desfazer o reembolso reativa ('active').
-- =============================================================================

-- 1) Flag de reembolso na compra (nullable = não reembolsado)
ALTER TABLE public.enrolled_emails
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- Índice parcial: o painel filtra "só reembolsados" com frequência
CREATE INDEX IF NOT EXISTS idx_enrolled_emails_refunded_at
  ON public.enrolled_emails (refunded_at)
  WHERE refunded_at IS NOT NULL;

-- 2) RPC: admin marca/desmarca reembolso de um aluno (por user_id)
--    - marca TODAS as linhas de enrolled_emails do email do aluno (cobre combos)
--    - expira/reativa o acesso conforme a escolha do Balla
CREATE OR REPLACE FUNCTION public.admin_set_student_refunded(
  p_user_id uuid,
  p_refunded boolean
)
RETURNS TABLE(ok boolean, affected integer, refunded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email    text;
  v_affected integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Só toca linhas que realmente mudam de estado
  UPDATE public.enrolled_emails
  SET refunded_at = CASE WHEN p_refunded THEN now() ELSE NULL END
  WHERE lower(email) = lower(v_email)
    AND (refunded_at IS NOT NULL) <> p_refunded;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- Efeito no acesso (Balla 2026-07-30): reembolso expira, desfazer reativa
  UPDATE public.profiles
  SET access_status = CASE WHEN p_refunded THEN 'expired' ELSE 'active' END,
      updated_at    = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT true, v_affected, p_refunded;
END;
$function$;

-- 3) admin_list_students_full: + coluna `refunded` (any compra do email reembolsada)
--    DROP necessário: mudar o tipo de retorno (nova coluna) não é permitido no REPLACE.
DROP FUNCTION IF EXISTS public.admin_list_students_full();
CREATE OR REPLACE FUNCTION public.admin_list_students_full()
RETURNS TABLE(
  user_id uuid, email text, display_name text, avatar_url text, phone text,
  is_blocked boolean, created_at timestamp with time zone,
  total_xp integer, daily_xp integer, coins integer, lives integer, streak integer,
  confidence integer, completed_phases integer[], badges jsonb, groups jsonb,
  access_status text, refunded boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    u.email::text,
    p.display_name,
    p.avatar_url,
    p.phone,
    p.is_blocked,
    p.created_at,
    COALESCE(up.total_xp, 0)::integer,
    COALESCE(up.daily_xp, 0)::integer,
    COALESCE(up.coins, 0)::integer,
    COALESCE(up.lives, 0)::integer,
    COALESCE(up.streak, 0)::integer,
    COALESCE(up.confidence, 0)::integer,
    COALESCE(up.completed_phases, ARRAY[]::integer[]),
    COALESCE(up.badges, '[]'::jsonb),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ag.id, 'name', ag.name))
       FROM public.access_group_users agu
       JOIN public.access_groups ag ON ag.id = agu.group_id
       WHERE agu.user_id = p.user_id),
      '[]'::jsonb
    ) AS groups,
    COALESCE(p.access_status, 'active') AS access_status,
    EXISTS(
      SELECT 1 FROM public.enrolled_emails e
      WHERE lower(e.email) = lower(u.email) AND e.refunded_at IS NOT NULL
    ) AS refunded
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.user_progress up ON up.user_id = p.user_id
  ORDER BY p.created_at DESC;
END;
$function$;
