-- ─────────────────────────────────────────────────────────────────────────────
-- Chat direto 1:1 admin <-> aluno.
-- Cada linha pertence à conversa de UM aluno (student_id). Toda mensagem, seja
-- do admin ou do aluno, carrega o student_id da conversa. Isso torna o RLS
-- trivial e à prova de vazamento:
--   • aluno SÓ lê linhas onde student_id = auth.uid()  → nunca vê a inbox de outro
--   • aluno SÓ insere com student_id = auth.uid() e sender='student'
--       → não consegue escrever na conversa de outro aluno
--       → não existe canal aluno->aluno (a tabela só liga aluno<->admin)
--   • admin (_is_admin()) lê/escreve/edita/apaga tudo
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('admin','student')),
  sender_id uuid references auth.users(id) on delete set null,
  body text,
  buttons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  read_by_student_at timestamptz,
  read_by_admin_at timestamptz,
  constraint dm_buttons_is_array check (jsonb_typeof(buttons) = 'array'),
  constraint dm_has_content check (
    (body is not null and length(btrim(body)) > 0)
    or (jsonb_typeof(buttons) = 'array' and jsonb_array_length(buttons) > 0)
  )
);

comment on table public.direct_messages is
  'Chat direto 1:1 admin<->aluno. student_id = dono da conversa; RLS isola cada aluno na própria conversa. Sem canal aluno<->aluno.';

create index if not exists idx_dm_student_created
  on public.direct_messages (student_id, created_at);
create index if not exists idx_dm_admin_unread
  on public.direct_messages (created_at)
  where sender = 'student' and read_by_admin_at is null;
create index if not exists idx_dm_student_unread
  on public.direct_messages (student_id)
  where sender = 'admin' and read_by_student_at is null;

alter table public.direct_messages enable row level security;
alter table public.direct_messages replica identity full;

-- SELECT: aluno só a própria conversa; admin tudo.
drop policy if exists dm_select on public.direct_messages;
create policy dm_select on public.direct_messages
  for select to authenticated
  using (student_id = auth.uid() or public._is_admin());

-- INSERT aluno: só na PRÓPRIA conversa, sempre como 'student'.
drop policy if exists dm_insert_student on public.direct_messages;
create policy dm_insert_student on public.direct_messages
  for insert to authenticated
  with check (sender = 'student' and student_id = auth.uid() and sender_id = auth.uid());

-- INSERT admin: como 'admin', em qualquer conversa.
drop policy if exists dm_insert_admin on public.direct_messages;
create policy dm_insert_admin on public.direct_messages
  for insert to authenticated
  with check (public._is_admin() and sender = 'admin' and sender_id = auth.uid());

-- UPDATE: só admin (marcar lido etc). Aluno marca lido via RPC SECURITY DEFINER.
drop policy if exists dm_update_admin on public.direct_messages;
create policy dm_update_admin on public.direct_messages
  for update to authenticated
  using (public._is_admin()) with check (public._is_admin());

-- DELETE: só admin.
drop policy if exists dm_delete_admin on public.direct_messages;
create policy dm_delete_admin on public.direct_messages
  for delete to authenticated
  using (public._is_admin());

-- Realtime: publica a tabela pra postgres_changes (RLS continua valendo por subscriber).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.direct_messages';
  end if;
end $$;

-- ─── RPC: aluno marca as mensagens do admin como lidas ───────────────────────
create or replace function public.dm_student_mark_read()
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  update public.direct_messages
    set read_by_student_at = now()
    where student_id = auth.uid()
      and sender = 'admin'
      and read_by_student_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ─── RPC: inbox do admin (1 linha por conversa, não-lidas primeiro) ───────────
create or replace function public.dm_admin_inbox()
returns table(
  student_id uuid,
  display_name text,
  email text,
  avatar_url text,
  last_message text,
  last_sender text,
  last_at timestamptz,
  unread_from_student integer,
  total_messages integer
)
language plpgsql security definer set search_path to 'public', 'auth'
as $$
begin
  if not public._is_admin() then raise exception 'admin_required'; end if;
  return query
  with convo as (
    select dm.student_id as sid,
      count(*)::int as total_messages,
      count(*) filter (where dm.sender = 'student' and dm.read_by_admin_at is null)::int as unread_from_student,
      max(dm.created_at) as last_at
    from public.direct_messages dm
    group by dm.student_id
  )
  select
    c.sid,
    coalesce(p.display_name, 'Aluna')::text,
    u.email::text,
    p.avatar_url,
    lm.body,
    lm.sender,
    c.last_at,
    c.unread_from_student,
    c.total_messages
  from convo c
  left join public.profiles p on p.user_id = c.sid
  left join auth.users u on u.id = c.sid
  left join lateral (
    select dm2.body, dm2.sender
    from public.direct_messages dm2
    where dm2.student_id = c.sid
    order by dm2.created_at desc
    limit 1
  ) lm on true
  order by c.unread_from_student desc, c.last_at desc;
end;
$$;

revoke all on function public.dm_student_mark_read() from public;
revoke all on function public.dm_admin_inbox() from public;
grant execute on function public.dm_student_mark_read() to authenticated;
grant execute on function public.dm_admin_inbox() to authenticated;
