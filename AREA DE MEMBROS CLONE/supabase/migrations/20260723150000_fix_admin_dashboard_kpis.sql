-- Fix do Dashboard admin (Visão Geral) — 2 bugs (2026-07-23):
--
-- 1) admin_overview_kpis.total_students contava public.enrolled_emails (296 linhas:
--    leads antigos, compras IGNORADAs de outros produtos Eduzz, duplicatas) →
--    mostrava "295 alunos" quando o real era 110. Agora conta ALUNAS COM ACESSO
--    (distinct access_group_users), mesma régua do inscritos_total() da sales page.
--
-- 2) admin_completion_by_course referenciava lessons.product_id — coluna que NÃO
--    existe (aula→módulo→curso via modules.product_id). A função quebrava em
--    runtime e a seção "Conclusão por curso" vinha vazia. Join corrigido.

create or replace function public.admin_overview_kpis()
returns table(total_students bigint, total_lessons_completed bigint, total_courses bigint, total_lessons bigint, total_wheel_spins bigint, total_coupons bigint, total_xp_sum bigint)
language plpgsql security definer set search_path = public
as $$
begin
  if not public._is_admin() then raise exception 'Acesso negado'; end if;
  return query
  select
    (select count(distinct agu.user_id) from public.access_group_users agu
       join auth.users u on u.id = agu.user_id
      where not exists (select 1 from public.user_roles ur where ur.user_id = agu.user_id and ur.role = 'admin')
        and u.email <> 'joautoescola@gmail.com'
        and u.email not like '%@mddnm.test'
        and u.email not like 'test-%'
        and u.email not like 'teste-%'),
    (select count(*) from public.lesson_progress lp
      where lp.completed = true
        and not exists (select 1 from public.user_roles ur where ur.user_id = lp.user_id and ur.role = 'admin')),
    (select count(*) from public.products),
    (select count(*) from public.lessons),
    (select count(*) from public.daily_wheel_spins dws
      where not exists (select 1 from public.user_roles ur where ur.user_id = dws.user_id and ur.role = 'admin')),
    (select count(*) from public.discount_coupons dc
      where not exists (select 1 from public.user_roles ur where ur.user_id = dc.user_id and ur.role = 'admin')),
    (select coalesce(sum(up.total_xp), 0) from public.user_progress up
      where not exists (select 1 from public.user_roles ur where ur.user_id = up.user_id and ur.role = 'admin'));
end;
$$;

create or replace function public.admin_completion_by_course()
returns table(product_id uuid, product_title text, total_lessons bigint, total_completions bigint, unique_students_completed bigint)
language plpgsql security definer set search_path = public
as $$
begin
  if not public._is_admin() then raise exception 'Acesso negado'; end if;
  return query
  select
    p.id,
    p.title,
    (select count(*) from public.lessons l
       join public.modules m on m.id = l.module_id
      where m.product_id = p.id),
    (select count(*) from public.lesson_progress lp
       join public.lessons l on l.id = lp.lesson_id
       join public.modules m on m.id = l.module_id
      where m.product_id = p.id and lp.completed = true
        and not exists (select 1 from public.user_roles ur where ur.user_id = lp.user_id and ur.role = 'admin')),
    (select count(distinct lp.user_id) from public.lesson_progress lp
       join public.lessons l on l.id = lp.lesson_id
       join public.modules m on m.id = l.module_id
      where m.product_id = p.id and lp.completed = true
        and not exists (select 1 from public.user_roles ur where ur.user_id = lp.user_id and ur.role = 'admin'))
  from public.products p
  order by p.title asc;
end;
$$;
