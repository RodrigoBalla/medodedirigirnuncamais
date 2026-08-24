-- Acesso do papel "support" (ex: Jô / joautoescola): LÊ tudo do /admin + responde
-- mensagens dos alunos. Toda ESCRITA permanece admin-only (RLS/RPCs de mutação
-- checam has_role('admin')). Verificado por impersonação: refund/edição bloqueados;
-- leitura e envio de mensagem OK; deletar mensagem bloqueado.

create or replace function public.is_staff()
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','support'));
$$;

insert into public.user_roles (user_id, role)
select u.id, 'support'::app_role from auth.users u where lower(u.email) = 'joautoescola@gmail.com'
on conflict (user_id, role) do nothing;

-- Libera as 8 RPCs de LEITURA (troca o gate has_role(admin) por is_staff()).
do $rw$
declare
  sigs text[] := array[
    'public.admin_get_student_access_snapshot(uuid)',
    'public.admin_get_student_course_detail(uuid,uuid)',
    'public.admin_get_student_email_metrics(uuid,integer)',
    'public.admin_list_course_notifications(integer)',
    'public.admin_list_notification_recipients()',
    'public.admin_list_notification_templates()',
    'public.admin_list_recipients_by_rules(uuid[],uuid[],text)',
    'public.admin_list_students_full()'
  ];
  s text; d text;
begin
  foreach s in array sigs loop
    d := pg_get_functiondef(s::regprocedure);
    d := replace(d, 'public.has_role(auth.uid(), ''admin''::app_role)', 'public.is_staff()');
    d := replace(d, 'has_role(auth.uid(), ''admin''::app_role)', 'public.is_staff()');
    execute d;
  end loop;
end
$rw$;

-- Policies de SELECT: admin-only -> is_staff() (leitura pro support)
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Staff can view all profiles" on public.profiles for select using (public.is_staff());
drop policy if exists "Admins can view all progress" on public.user_progress;
create policy "Staff can view all progress" on public.user_progress for select using (public.is_staff());
drop policy if exists "Admins can view all page views" on public.page_views;
create policy "Staff can view all page views" on public.page_views for select using (public.is_staff());
drop policy if exists "lesson_progress_admin_read_all" on public.lesson_progress;
create policy "lesson_progress_staff_read_all" on public.lesson_progress for select using (public.is_staff());
drop policy if exists "admin_read_all" on public.course_notifications;
create policy "staff_read_all" on public.course_notifications for select using (public.is_staff());
drop policy if exists "admin reads support requests" on public.support_requests;
create policy "staff reads support requests" on public.support_requests for select using (public.is_staff());

drop policy if exists "Students see own membership, admin sees all" on public.access_group_users;
create policy "Students see own membership, staff sees all" on public.access_group_users
  for select using ((user_id = auth.uid()) OR public.is_staff());

drop policy if exists "staff read all products" on public.products;
create policy "staff read all products" on public.products for select using (public.is_staff());
drop policy if exists "staff read all modules" on public.modules;
create policy "staff read all modules" on public.modules for select using (public.is_staff());
drop policy if exists "staff read all lessons" on public.lessons;
create policy "staff read all lessons" on public.lessons for select using (public.is_staff());
drop policy if exists "staff read enrolled_emails" on public.enrolled_emails;
create policy "staff read enrolled_emails" on public.enrolled_emails for select using (public.is_staff());

-- Mensagens: support LÊ e RESPONDE (envia + marca lido); NÃO deleta.
drop policy if exists "dm_select" on public.direct_messages;
create policy "dm_select" on public.direct_messages for select
  using ((student_id = auth.uid()) OR public.is_staff());
drop policy if exists "dm_insert_admin" on public.direct_messages;
create policy "dm_insert_admin" on public.direct_messages for insert
  with check (public.is_staff() AND (sender = 'admin') AND (sender_id = auth.uid()));
drop policy if exists "dm_update_admin" on public.direct_messages;
create policy "dm_update_admin" on public.direct_messages for update
  using (public.is_staff()) with check (public.is_staff());
-- dm_delete_admin permanece _is_admin() (support não deleta)
