-- ─────────────────────────────────────────────────────────────────────────────
-- Pesquisa NPS gamificada + recompensa em moedas.
--   • nps_config  → liga/desliga a pesquisa + valor da recompensa (admin edita)
--   • nps_responses → 1 resposta por aluna (unique user_id)
--   • submit_nps_response(jsonb) → grava + credita a recompensa 1x (anti-farm),
--       creditando moedas no MESMO padrão da roleta (coin_transactions + user_progress)
--   • get_my_nps_status() → o front sabe se deve mostrar o popup
--   • admin_nps_summary() / admin_nps_responses() → dados p/ a aba PESQUISA NPS
-- Recompensa padrão: 1000 moedas = R$10 (taxa 100 moedas/R$1 do cashback).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.nps_config (
  id int primary key default 1,
  active boolean not null default true,
  reward_coins int not null default 1000,
  reward_expiry_days int not null default 90,
  constraint nps_config_singleton check (id = 1)
);
insert into public.nps_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nps_score int not null check (nps_score between 0 and 10),
  reason text,
  fear_before int check (fear_before between 1 and 5),
  fear_after int check (fear_after between 1 and 5),
  driving_status text,
  liked_most text[] not null default '{}',
  wants_more text[] not null default '{}',
  missing text,
  testimonial text,
  testimonial_consent boolean not null default false,
  continue_interest text,
  reward_coins int not null default 0,
  ai_sentiment text,
  ai_themes text[],
  ai_summary text,
  ai_processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.nps_responses enable row level security;
alter table public.nps_config enable row level security;

drop policy if exists nps_config_select on public.nps_config;
create policy nps_config_select on public.nps_config for select to authenticated using (true);
drop policy if exists nps_config_admin on public.nps_config;
create policy nps_config_admin on public.nps_config for all to authenticated using (public._is_admin()) with check (public._is_admin());

drop policy if exists nps_resp_select on public.nps_responses;
create policy nps_resp_select on public.nps_responses for select to authenticated using (user_id = auth.uid() or public._is_admin());
drop policy if exists nps_resp_insert on public.nps_responses;
create policy nps_resp_insert on public.nps_responses for insert to authenticated with check (user_id = auth.uid());
drop policy if exists nps_resp_admin_upd on public.nps_responses;
create policy nps_resp_admin_upd on public.nps_responses for update to authenticated using (public._is_admin()) with check (public._is_admin());

-- ─── Status: o front decide se mostra o popup ────────────────────────────────
create or replace function public.get_my_nps_status()
returns table(should_show boolean, already_responded boolean, reward_coins int)
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_active boolean; v_reward int; v_done boolean;
begin
  if v_uid is null then return; end if;
  select nc.active, nc.reward_coins into v_active, v_reward from public.nps_config nc where nc.id = 1;
  select exists(select 1 from public.nps_responses where user_id = v_uid) into v_done;
  should_show := coalesce(v_active, false)
    and not v_done
    and not public._is_admin()
    and exists(select 1 from public.access_group_users where user_id = v_uid);
  already_responded := v_done;
  reward_coins := coalesce(v_reward, 1000);
  return next;
end; $$;

-- ─── Submit: grava + credita recompensa 1x ───────────────────────────────────
create or replace function public.submit_nps_response(p jsonb)
returns table(reward_coins int, balance int, already_responded boolean)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_reward int; v_expiry int;
  v_n int;
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  select nc.reward_coins, nc.reward_expiry_days into v_reward, v_expiry from public.nps_config nc where nc.id = 1;
  v_reward := coalesce(v_reward, 1000);
  v_expiry := coalesce(v_expiry, 90);

  insert into public.nps_responses (
    user_id, nps_score, reason, fear_before, fear_after, driving_status,
    liked_most, wants_more, missing, testimonial, testimonial_consent, continue_interest, reward_coins
  ) values (
    v_uid,
    (p->>'nps_score')::int,
    nullif(btrim(coalesce(p->>'reason','')), ''),
    nullif(p->>'fear_before','')::int,
    nullif(p->>'fear_after','')::int,
    nullif(btrim(coalesce(p->>'driving_status','')), ''),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'liked_most') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'wants_more') x), '{}'),
    nullif(btrim(coalesce(p->>'missing','')), ''),
    nullif(btrim(coalesce(p->>'testimonial','')), ''),
    coalesce((p->>'testimonial_consent')::boolean, false),
    nullif(btrim(coalesce(p->>'continue_interest','')), ''),
    v_reward
  )
  on conflict (user_id) do nothing;

  get diagnostics v_n = row_count;

  if v_n > 0 then
    insert into public.coin_transactions (user_id, amount, source, description, expires_at)
      values (v_uid, v_reward, 'nps_survey', 'Recompensa da Pesquisa NPS', now() + (v_expiry || ' days')::interval);
    update public.user_progress set coins = coalesce(coins, 0) + v_reward where user_id = v_uid;
    reward_coins := v_reward;
    already_responded := false;
  else
    reward_coins := 0;
    already_responded := true;
  end if;

  select public.get_valid_coins_balance() into balance;
  return next;
end; $$;

-- ─── Admin: agregados p/ gráficos ────────────────────────────────────────────
create or replace function public.admin_nps_summary()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare v jsonb; v_total int; v_prom int; v_det int;
begin
  if not public._is_admin() then raise exception 'admin_required'; end if;
  select count(*) into v_total from public.nps_responses;
  select count(*) filter (where nps_score >= 9), count(*) filter (where nps_score <= 6)
    into v_prom, v_det from public.nps_responses;

  v := jsonb_build_object(
    'total', v_total,
    'nps', case when v_total > 0 then round(((v_prom - v_det)::numeric / v_total) * 100) else 0 end,
    'promoters', v_prom,
    'passives', v_total - v_prom - v_det,
    'detractors', v_det,
    'avg_score', (select coalesce(round(avg(nps_score)::numeric, 1), 0) from public.nps_responses),
    'fear_before', (select coalesce(round(avg(fear_before)::numeric, 2), 0) from public.nps_responses where fear_before is not null),
    'fear_after', (select coalesce(round(avg(fear_after)::numeric, 2), 0) from public.nps_responses where fear_after is not null),
    'testimonials', (select count(*) from public.nps_responses where testimonial is not null and testimonial_consent),
    'score_dist', (select coalesce(jsonb_agg(jsonb_build_object('score', s, 'count', c) order by s), '[]')
                   from (select nps_score s, count(*) c from public.nps_responses group by nps_score) t),
    'driving', (select coalesce(jsonb_object_agg(coalesce(driving_status,'?'), c), '{}')
                from (select driving_status, count(*) c from public.nps_responses group by driving_status) t),
    'continue', (select coalesce(jsonb_object_agg(coalesce(continue_interest,'?'), c), '{}')
                 from (select continue_interest, count(*) c from public.nps_responses group by continue_interest) t),
    'liked', (select coalesce(jsonb_object_agg(v, c), '{}')
              from (select unnest(liked_most) v, count(*) c from public.nps_responses group by 1) t),
    'wants', (select coalesce(jsonb_object_agg(v, c), '{}')
              from (select unnest(wants_more) v, count(*) c from public.nps_responses group by 1) t),
    'sentiment', (select coalesce(jsonb_object_agg(coalesce(ai_sentiment,'?'), c), '{}')
                  from (select ai_sentiment, count(*) c from public.nps_responses group by ai_sentiment) t),
    'themes', (select coalesce(jsonb_object_agg(v, c), '{}')
               from (select unnest(ai_themes) v, count(*) c from public.nps_responses where ai_themes is not null group by 1) t)
  );
  return v;
end; $$;

-- ─── Admin: lista completa de respostas ──────────────────────────────────────
create or replace function public.admin_nps_responses()
returns table(
  id uuid, user_id uuid, display_name text, email text,
  nps_score int, reason text, fear_before int, fear_after int, driving_status text,
  liked_most text[], wants_more text[], missing text, testimonial text, testimonial_consent boolean,
  continue_interest text, ai_sentiment text, ai_themes text[], ai_summary text, created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public', 'auth'
as $$
begin
  if not public._is_admin() then raise exception 'admin_required'; end if;
  return query
  select r.id, r.user_id, coalesce(p.display_name, 'Aluna')::text, u.email::text,
    r.nps_score, r.reason, r.fear_before, r.fear_after, r.driving_status,
    r.liked_most, r.wants_more, r.missing, r.testimonial, r.testimonial_consent,
    r.continue_interest, r.ai_sentiment, r.ai_themes, r.ai_summary, r.created_at
  from public.nps_responses r
  left join public.profiles p on p.user_id = r.user_id
  left join auth.users u on u.id = r.user_id
  order by r.created_at desc;
end; $$;

revoke all on function public.get_my_nps_status() from public;
revoke all on function public.submit_nps_response(jsonb) from public;
revoke all on function public.admin_nps_summary() from public;
revoke all on function public.admin_nps_responses() from public;
grant execute on function public.get_my_nps_status() to authenticated;
grant execute on function public.submit_nps_response(jsonb) to authenticated;
grant execute on function public.admin_nps_summary() to authenticated;
grant execute on function public.admin_nps_responses() to authenticated;
