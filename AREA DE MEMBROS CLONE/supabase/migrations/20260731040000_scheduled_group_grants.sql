-- ════════════════════════════════════════════════════════════════════════════
-- Liberação escalonada de 7 dias (drip) dos upsells.
--
-- Regra (definida pelo Balla 2026-07-31):
--   • Quando a compra inclui o módulo PRINCIPAL ("Medo de Dirigir Nunca Mais —
--     Método Completo", grupo "Acesso Completo") JUNTO com upsells, o principal
--     libera na hora e os upsells ficam agendados pra +7 dias.
--   • Upsell comprado SOZINHO (sem o principal na mesma compra) libera na hora.
--   • Vale só pra compras NOVAS. Upsell que a aluna JÁ tem nunca é re-travado.
--
-- Fonte de verdade do agendamento: scheduled_group_grants.
-- Cron horário chama release_due_group_grants() → move os vencidos pra
-- access_group_users (via grant_access_with_expiry).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.scheduled_group_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_id    uuid not null references public.access_groups(id) on delete cascade,
  release_at  timestamptz not null,
  granted_at  timestamptz,                 -- null = pendente; setado quando libera
  source      text,                        -- opcional (ex: fatura Eduzz)
  created_at  timestamptz not null default now(),
  unique (user_id, group_id)
);

comment on table public.scheduled_group_grants is
  'Grupos comprados que ficam represados por N dias (drip dos upsells). granted_at null = ainda contando.';

create index if not exists idx_sgg_due
  on public.scheduled_group_grants (release_at)
  where granted_at is null;

-- ── RLS: aluna vê os PRÓPRIOS agendamentos (pro contador na biblioteca); admin vê tudo.
alter table public.scheduled_group_grants enable row level security;

drop policy if exists "sgg student reads own, admin all" on public.scheduled_group_grants;
create policy "sgg student reads own, admin all"
  on public.scheduled_group_grants
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
  );

drop policy if exists "sgg admin write" on public.scheduled_group_grants;
create policy "sgg admin write"
  on public.scheduled_group_grants
  for all
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- grant_or_schedule_groups: aplica a regra do drip. Chamada pelo eduzz-webhook
-- (service role) no lugar do loop de grant_access_with_expiry.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.grant_or_schedule_groups(
  p_user_id    uuid,
  p_group_ids  uuid[],
  p_months     integer default 12,
  p_delay_days integer default 7
)
returns table(granted integer, scheduled integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_main      uuid;
  v_has_main  boolean;
  v_others    uuid[];
  gid         uuid;
  v_granted   integer := 0;
  v_scheduled integer := 0;
begin
  if p_user_id is null or p_group_ids is null or array_length(p_group_ids, 1) is null then
    return query select 0, 0; return;
  end if;

  -- Principal = grupo "Acesso Completo" (Método Completo). Lookup por nome com
  -- fallback pro id conhecido, pra sobreviver a rename acidental.
  select id into v_main from public.access_groups where lower(name) = lower('Acesso Completo') limit 1;
  if v_main is null then v_main := 'f643bffb-403f-433d-ba1b-164889f76e2c'::uuid; end if;

  v_has_main := v_main = any(p_group_ids);
  v_others   := array(select distinct g from unnest(p_group_ids) g where g <> v_main);

  if v_has_main and array_length(v_others, 1) > 0 then
    -- Principal agora
    perform public.grant_access_with_expiry(p_user_id, v_main, p_months);
    v_granted := 1;
    -- Upsells: agenda +N dias, exceto os que a aluna JÁ tem
    foreach gid in array v_others loop
      if exists (select 1 from public.access_group_users where user_id = p_user_id and group_id = gid) then
        continue;
      end if;
      insert into public.scheduled_group_grants (user_id, group_id, release_at)
      values (p_user_id, gid, now() + (p_delay_days * interval '1 day'))
      on conflict (user_id, group_id) do update
        set release_at = least(public.scheduled_group_grants.release_at, excluded.release_at)
        where public.scheduled_group_grants.granted_at is null;
      v_scheduled := v_scheduled + 1;
    end loop;
  else
    -- Sem principal na compra (ou só principal): libera tudo agora (comportamento antigo)
    foreach gid in array p_group_ids loop
      perform public.grant_access_with_expiry(p_user_id, gid, p_months);
      v_granted := v_granted + 1;
    end loop;
  end if;

  return query select v_granted, v_scheduled;
end;
$$;

revoke all on function public.grant_or_schedule_groups(uuid, uuid[], integer, integer) from public;

-- ════════════════════════════════════════════════════════════════════════════
-- release_due_group_grants: libera os agendamentos vencidos. Rodado pelo pg_cron.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.release_due_group_grants()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id, user_id, group_id
    from public.scheduled_group_grants
    where granted_at is null and release_at <= now()
    for update skip locked
  loop
    perform public.grant_access_with_expiry(r.user_id, r.group_id, 12);
    update public.scheduled_group_grants set granted_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.release_due_group_grants() from public;

-- ── Cron: libera vencidos de hora em hora (delay de <1h num drip de 7 dias é ok).
do $cron$
begin
  perform cron.unschedule('release-group-grants');
exception when others then null;  -- ignora se o job ainda não existe
end
$cron$;

select cron.schedule('release-group-grants', '7 * * * *', $$select public.release_due_group_grants();$$);
