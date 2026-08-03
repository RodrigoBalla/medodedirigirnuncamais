-- Reembolso agora TAMBÉM revoga as sessões do aluno (força logout em qualquer
-- aparelho/aba). RLS + access_status='expired' já bloqueiam leitura nova de
-- lessons/modules; isto fecha a janela de uma sessão/aba que já estava carregada
-- antes do reembolso (o iframe de vídeo que continuava tocando).
create or replace function public.admin_set_student_refunded(p_user_id uuid, p_refunded boolean)
 returns table(ok boolean, affected integer, refunded boolean)
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
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

  UPDATE public.enrolled_emails
  SET refunded_at = CASE WHEN p_refunded THEN now() ELSE NULL END
  WHERE lower(email) = lower(v_email)
    AND (refunded_at IS NOT NULL) <> p_refunded;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  UPDATE public.profiles
  SET access_status = CASE WHEN p_refunded THEN 'expired' ELSE 'active' END,
      updated_at    = now()
  WHERE user_id = p_user_id;

  IF p_refunded THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT true, v_affected, p_refunded;
END;
$function$;
