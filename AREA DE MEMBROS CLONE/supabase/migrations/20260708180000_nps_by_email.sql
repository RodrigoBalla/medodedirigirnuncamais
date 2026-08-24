-- ─────────────────────────────────────────────────────────────────────────────
-- Pesquisa NPS INDEPENDENTE (sem login) — vincula a resposta ao aluno pelo EMAIL.
--   • email na nps_responses + user_id nullable + unique(lower(email))
--   • RPCs públicas (anon): nps_check_email, submit_nps_by_email, nps_locked_modules
-- A conta é resolvida a partir do email (auth.users) no servidor; a recompensa
-- em moedas cai na carteira dessa conta. 1 resposta por email (e por user_id).
-- ⚠️ Endpoint público: protege por "email precisa existir + 1 por email".
-- OBS: `found` é palavra reservada em plpgsql (setada por todo SQL) — por isso
-- o OUT param se chama `email_found`.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.nps_responses add column if not exists email text;
alter table public.nps_responses alter column user_id drop not null;
create unique index if not exists nps_responses_email_uniq on public.nps_responses (lower(email)) where email is not null;

create or replace function public.nps_check_email(p_email text)
returns table(email_found boolean, already_responded boolean, first_name text)
language plpgsql stable security definer set search_path to 'public', 'auth'
as $$
declare v_uid uuid; v_email text := lower(btrim(coalesce(p_email,''))); v_name text; v_done boolean;
begin
  email_found := false; already_responded := false; first_name := null;
  if v_email = '' then return next; return; end if;
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  if v_uid is null then return next; return; end if;
  select coalesce(p.display_name, '') into v_name from public.profiles p where p.user_id = v_uid;
  select exists(select 1 from public.nps_responses r where r.user_id = v_uid or lower(r.email) = v_email) into v_done;
  email_found := true;
  already_responded := v_done;
  first_name := nullif(split_part(coalesce(v_name,''), ' ', 1), '');
  return next;
end; $$;

create or replace function public.submit_nps_by_email(p_email text, p jsonb)
returns table(reward_coins int, balance int, email_found boolean, already_responded boolean)
language plpgsql security definer set search_path to 'public', 'auth'
as $$
declare
  v_uid uuid; v_email text := lower(btrim(coalesce(p_email,'')));
  v_reward int; v_expiry int; v_n int;
begin
  reward_coins := 0; balance := 0; email_found := false; already_responded := false;
  if v_email = '' then return next; return; end if;
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  if v_uid is null then return next; return; end if;

  select nc.reward_coins, nc.reward_expiry_days into v_reward, v_expiry from public.nps_config nc where nc.id = 1;
  v_reward := coalesce(v_reward, 1000);
  v_expiry := coalesce(v_expiry, 90);

  insert into public.nps_responses (
    user_id, email, nps_score, reason, fear_before, fear_after, driving_status,
    liked_most, wants_more, missing, testimonial, testimonial_consent, continue_interest, reward_coins
  ) values (
    v_uid, v_email,
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
  on conflict do nothing;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    insert into public.coin_transactions (user_id, amount, source, description, expires_at)
      values (v_uid, v_reward, 'nps_survey', 'Recompensa da Pesquisa NPS', now() + (v_expiry || ' days')::interval);
    update public.user_progress set coins = coalesce(coins,0) + v_reward where user_id = v_uid;
    reward_coins := v_reward;
  else
    already_responded := true;
  end if;

  email_found := true;
  select coalesce(sum(amount),0) into balance from public.coin_transactions
    where user_id = v_uid and (expires_at is null or expires_at > now());
  return next;
end; $$;

create or replace function public.nps_locked_modules(p_email text)
returns table(id uuid, title text, image_url text, checkout_url text)
language plpgsql stable security definer set search_path to 'public', 'auth'
as $$
declare v_uid uuid; v_email text := lower(btrim(coalesce(p_email,'')));
begin
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  return query
  select p.id, p.title, p.image_url, p.checkout_url
  from public.products p
  where p.status = 'published' and p.checkout_url is not null
    and (v_uid is null or not exists (
      select 1 from public.access_group_users agu
      join public.access_group_products agp on agp.group_id = agu.group_id
      where agu.user_id = v_uid and agp.product_id = p.id
    ))
  order by p.created_at;
end; $$;

revoke all on function public.nps_check_email(text) from public;
revoke all on function public.submit_nps_by_email(text, jsonb) from public;
revoke all on function public.nps_locked_modules(text) from public;
grant execute on function public.nps_check_email(text) to anon, authenticated;
grant execute on function public.submit_nps_by_email(text, jsonb) to anon, authenticated;
grant execute on function public.nps_locked_modules(text) to anon, authenticated;
