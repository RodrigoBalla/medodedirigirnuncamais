-- admin_list_students_full agora também retorna pending_groups: grupos comprados
-- mas represados no drip de 7 dias (scheduled_group_grants com granted_at NULL),
-- com release_at. A aba Alunas do admin mostra badges "A LIBERAR · <grupo> · Xd".
drop function if exists public.admin_list_students_full();

create function public.admin_list_students_full()
 returns table(user_id uuid, email text, display_name text, avatar_url text, phone text, is_blocked boolean, created_at timestamp with time zone, total_xp integer, daily_xp integer, coins integer, lives integer, streak integer, confidence integer, completed_phases integer[], badges jsonb, groups jsonb, pending_groups jsonb, access_status text, refunded boolean)
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
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
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', ag2.id, 'name', ag2.name, 'release_at', sgg.release_at) ORDER BY sgg.release_at)
       FROM public.scheduled_group_grants sgg
       JOIN public.access_groups ag2 ON ag2.id = sgg.group_id
       WHERE sgg.user_id = p.user_id AND sgg.granted_at IS NULL),
      '[]'::jsonb
    ) AS pending_groups,
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
