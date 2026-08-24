-- admin_get_student_access_snapshot: cada curso ganha release_at (menor data
-- agendada no drip de 7 dias, se houver e ainda não liberado) — pro "Espelho do
-- acesso" (StudentAccessPreview) mostrar "Chegando · libera em X" em vez de
-- "Trancado" nos upsells represados. Ordem: liberados → chegando → trancados.
create or replace function public.admin_get_student_access_snapshot(p_user_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
DECLARE
  v_groups uuid[];
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT COALESCE(array_agg(group_id), '{}') INTO v_groups
  FROM public.access_group_users WHERE user_id = p_user_id;

  SELECT jsonb_build_object(
    'student', (
      SELECT jsonb_build_object(
        'user_id', pr.user_id,
        'display_name', COALESCE(pr.display_name, 'Aluna'),
        'email', u.email,
        'avatar_url', pr.avatar_url,
        'access_status', COALESCE(pr.access_status, 'active'),
        'is_blocked', COALESCE(pr.is_blocked, false),
        'total_xp', COALESCE(up.total_xp, 0),
        'streak', COALESCE(up.streak, 0),
        'coins', COALESCE(up.coins, 0)
      )
      FROM public.profiles pr
      LEFT JOIN auth.users u ON u.id = pr.user_id
      LEFT JOIN public.user_progress up ON up.user_id = pr.user_id
      WHERE pr.user_id = p_user_id
    ),
    'groups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ag.id, 'name', ag.name) ORDER BY ag.name), '[]'::jsonb)
      FROM public.access_groups ag
      WHERE ag.id = ANY(v_groups)
    ),
    'courses', (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.unlocked DESC, (c.release_at IS NOT NULL) DESC, c.title), '[]'::jsonb)
      FROM (
        SELECT
          prod.id AS product_id,
          prod.title,
          prod.image_url,
          EXISTS (
            SELECT 1 FROM public.access_group_products agp
            WHERE agp.product_id = prod.id AND agp.group_id = ANY(v_groups)
          ) AS unlocked,
          (SELECT min(sgg.release_at)
             FROM public.scheduled_group_grants sgg
             JOIN public.access_group_products agp2 ON agp2.group_id = sgg.group_id
             WHERE agp2.product_id = prod.id AND sgg.user_id = p_user_id AND sgg.granted_at IS NULL
          ) AS release_at,
          (SELECT count(*)::int FROM public.lessons l
             JOIN public.modules m ON m.id = l.module_id
             WHERE m.product_id = prod.id) AS lessons_total,
          (SELECT count(*)::int FROM public.lesson_progress lp
             JOIN public.lessons l ON l.id = lp.lesson_id
             JOIN public.modules m ON m.id = l.module_id
             WHERE m.product_id = prod.id AND lp.user_id = p_user_id AND lp.completed = true) AS lessons_completed
        FROM public.products prod
        WHERE prod.status = 'published'
      ) c
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
