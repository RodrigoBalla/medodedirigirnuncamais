-- RPC pra admin pegar (ou criar) token de primeiro acesso de um aluno.
-- Reutiliza token ativo (não usado e não expirado); senão cria um novo.
-- Usado pelos botões "Copiar link de primeiro acesso" e "Reenviar email" na
-- aba Alunos do painel admin.
CREATE OR REPLACE FUNCTION public.admin_first_access_for_user(p_user_id uuid)
RETURNS TABLE(token uuid, email text, display_name text, course_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
  v_name text;
  v_course text;
  v_existing_token uuid;
  v_new_token uuid;
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id LIMIT 1;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT COALESCE(NULLIF(p.display_name, ''), 'Aluna') INTO v_name
  FROM public.profiles p WHERE p.user_id = p_user_id LIMIT 1;
  v_name := COALESCE(v_name, 'Aluna');

  SELECT fat.course_title INTO v_course
  FROM public.first_access_tokens fat
  WHERE fat.user_id = p_user_id
  ORDER BY fat.created_at DESC
  LIMIT 1;
  v_course := COALESCE(NULLIF(v_course, ''), 'Medo de Dirigir Nunca Mais');

  SELECT fat.token INTO v_existing_token
  FROM public.first_access_tokens fat
  WHERE fat.user_id = p_user_id
    AND fat.used_at IS NULL
    AND fat.expires_at > now()
  ORDER BY fat.created_at DESC
  LIMIT 1;

  IF v_existing_token IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_token, v_email, v_name, v_course;
    RETURN;
  END IF;

  INSERT INTO public.first_access_tokens (user_id, email, course_title)
  VALUES (p_user_id, v_email, v_course)
  RETURNING first_access_tokens.token INTO v_new_token;

  RETURN QUERY SELECT v_new_token, v_email, v_name, v_course;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_first_access_for_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_first_access_for_user(uuid) TO authenticated;
