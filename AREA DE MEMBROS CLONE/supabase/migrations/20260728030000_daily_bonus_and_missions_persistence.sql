-- ─────────────────────────────────────────────────────────────────────────────
-- Persistência do Bônus Diário e das Missões Diárias no BANCO (era localStorage).
--
-- Mesma classe de bug já corrigida no plano da semana (weekly_plan_completions):
-- o "já resgatei hoje" ficava em localStorage — por dispositivo/navegador. Isso
-- (1) não sincronizava entre mobile e web e (2) deixava a aluna RESGATAR A MESMA
-- recompensa em cada dispositivo (localStorage não é fonte de verdade nem
-- idempotente).
--
-- Correção: uma linha por (user, dia[, missão]) com PRIMARY KEY, e RPC
-- SECURITY DEFINER idempotente que credita 1x via `on conflict do nothing`. A
-- recompensa é SERVER-AUTHORITATIVE (o servidor decide o valor pelo streak /
-- pela missão — não confia no que o cliente manda). Moedas sempre pela RPC
-- add_coins (mesma fonte única: extrato coin_transactions + espelho
-- user_progress.coins — ver get_valid_coins_balance).
--
-- O "dia" é o dia-calendário em America/Sao_Paulo, pra bater com o jeito que o
-- app pensa "hoje" (streak/daily_xp usam o horário local da aluna, BR).
--
-- Migração do localStorage antigo → banco é feita pelo FRONTEND com um INSERT
-- direto (RLS insert_self), SEM passar pela RPC, logo SEM re-creditar: as moedas
-- daquele dia já foram dadas no dispositivo onde o resgate aconteceu.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ Bônus Diário ════════════════════════════════════════════════════════════
-- Uma linha = um resgate do bônus num dia. PK (user, dia) → no máx. 1 por dia.
-- As colunas de recompensa são só AUDITORIA (a idempotência e o crédito não
-- dependem delas); a migração do localStorage deixa elas nulas/'legacy'.
create table if not exists public.daily_bonus_claims (
  user_id       uuid not null references auth.users(id) on delete cascade,
  claim_date    date not null,
  slot          smallint,            -- dia da escadinha resgatado (1..7) — auditoria
  reward_type   text,                -- coins | xp | life | chest | legacy — auditoria
  reward_amount integer,             -- auditoria
  created_at    timestamptz not null default now(),
  primary key (user_id, claim_date)
);

comment on table public.daily_bonus_claims is
  'Resgates do Bônus Diário (1 por user/dia, fonte de verdade server-side). Crédito via claim_daily_bonus().';

alter table public.daily_bonus_claims enable row level security;

-- Aluna vê/insere só as PRÓPRIAS linhas. O insert é usado só pela migração do
-- localStorage (marcar "já resgatei hoje"); o crédito real é só pela RPC.
drop policy if exists dbc_select_self on public.daily_bonus_claims;
create policy dbc_select_self on public.daily_bonus_claims
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists dbc_insert_self on public.daily_bonus_claims;
create policy dbc_insert_self on public.daily_bonus_claims
  for insert to authenticated
  with check (user_id = auth.uid());

-- ═══ Missões Diárias ═════════════════════════════════════════════════════════
-- Uma linha = uma missão resgatada num dia. PK (user, dia, missão).
create table if not exists public.daily_mission_claims (
  user_id       uuid not null references auth.users(id) on delete cascade,
  claim_date    date not null,
  mission_id    text not null,       -- xp_50 | lesson_1 | streak_1
  reward_type   text,                -- coins | xp | legacy — auditoria
  reward_amount integer,             -- auditoria
  created_at    timestamptz not null default now(),
  primary key (user_id, claim_date, mission_id)
);

comment on table public.daily_mission_claims is
  'Resgates das Missões Diárias (1 por user/dia/missão, server-side). Crédito via claim_daily_mission().';

alter table public.daily_mission_claims enable row level security;

drop policy if exists dmc_select_self on public.daily_mission_claims;
create policy dmc_select_self on public.daily_mission_claims
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists dmc_insert_self on public.daily_mission_claims;
create policy dmc_insert_self on public.daily_mission_claims
  for insert to authenticated
  with check (user_id = auth.uid());

-- ═══ RPC: resgatar o Bônus Diário (idempotente, server-authoritative) ═════════
-- O servidor deriva o slot pelo streak (least(streak,7)) e a recompensa por uma
-- tabela fixa igual à do front (DAILY_REWARDS). Credita 1x: se já existe linha
-- pra hoje, retorna credited=false sem creditar de novo.
--
-- Economia PRESERVADA do comportamento atual: hoje o callback só credita 'coins'
-- e 'xp' (os tipos 'life' e 'chest' NÃO são creditados por nada no código atual).
-- Aqui a linha é gravada (marca resgatado) mas 'life'/'chest' seguem sem crédito,
-- pra não mudar a economia de todas as alunas sem intenção. (Bug latente separado:
-- o "BAÚ! 100" do dia 7 e a "+1 vida" do dia 4 hoje dão nada.)
create or replace function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_streak    integer;
  v_slot      smallint;
  v_type      text;
  v_amount    integer;
  v_credit    integer;
  v_boost     timestamptz;
  v_total_xp  integer;
  v_new_total integer;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select streak into v_streak from public.user_progress where user_id = v_uid;
  v_slot := least(greatest(coalesce(v_streak, 0), 0), 7);
  if v_slot < 1 then
    return jsonb_build_object('credited', false, 'reason', 'no_streak');
  end if;

  -- Tabela de recompensas (espelho de DAILY_REWARDS no front).
  case v_slot
    when 1 then v_type := 'coins'; v_amount := 10;
    when 2 then v_type := 'xp';    v_amount := 15;
    when 3 then v_type := 'coins'; v_amount := 25;
    when 4 then v_type := 'life';  v_amount := 1;
    when 5 then v_type := 'coins'; v_amount := 50;
    when 6 then v_type := 'xp';    v_amount := 30;
    when 7 then v_type := 'chest'; v_amount := 100;
  end case;

  -- Idempotência: 1 resgate por dia. Se já existe, não credita de novo.
  insert into public.daily_bonus_claims (user_id, claim_date, slot, reward_type, reward_amount)
  values (v_uid, v_today, v_slot, v_type, v_amount)
  on conflict (user_id, claim_date) do nothing;

  if not found then
    return jsonb_build_object('credited', false, 'reason', 'already_claimed');
  end if;

  -- Crédito (mesma economia de hoje: só 'coins' e 'xp' creditam de fato).
  if v_type = 'coins' then
    perform public.add_coins(v_amount, 'daily_bonus');
  elsif v_type = 'xp' then
    v_credit := v_amount;
    select xp_boost_expires_at, total_xp into v_boost, v_total_xp
      from public.user_progress where user_id = v_uid;
    if v_boost is not null and v_boost > now() then
      v_credit := v_credit * 2;   -- XP Turbo ativo dobra (igual ao addXP do front)
    end if;
    v_new_total := coalesce(v_total_xp, 0) + v_credit;
    update public.user_progress
      set total_xp = v_new_total,
          daily_xp = coalesce(daily_xp, 0) + v_credit,
          league   = case
                       when v_new_total >= 5000 then 'Diamante'
                       when v_new_total >= 2500 then 'Ouro'
                       when v_new_total >= 1000 then 'Prata'
                       else 'Bronze'
                     end
      where user_id = v_uid;
  end if;
  -- 'life' e 'chest': linha gravada, sem crédito (preserva comportamento atual).

  return jsonb_build_object(
    'credited', true, 'slot', v_slot, 'reward_type', v_type, 'reward_amount', v_amount
  );
end;
$$;

-- ═══ RPC: resgatar uma Missão Diária (idempotente, server-authoritative) ══════
-- Valida server-side que a missão está REALMENTE cumprida (não confia no cliente)
-- e credita 1x por dia/missão.
create or replace function public.claim_daily_mission(p_mission_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dxp       integer;
  v_dlessons  integer;
  v_streak    integer;
  v_type      text;
  v_amount    integer;
  v_done      boolean;
  v_credit    integer;
  v_boost     timestamptz;
  v_total_xp  integer;
  v_new_total integer;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select daily_xp, daily_lessons, streak
    into v_dxp, v_dlessons, v_streak
    from public.user_progress where user_id = v_uid;

  -- Recompensa + condição de conclusão (espelho das missions do front).
  if p_mission_id = 'xp_50' then
    v_type := 'coins'; v_amount := 15; v_done := coalesce(v_dxp, 0) >= 50;
  elsif p_mission_id = 'lesson_1' then
    v_type := 'xp';    v_amount := 20; v_done := coalesce(v_dlessons, 0) >= 1;
  elsif p_mission_id = 'streak_1' then
    v_type := 'coins'; v_amount := 10; v_done := coalesce(v_streak, 0) > 0;
  else
    raise exception 'unknown_mission: %', p_mission_id;
  end if;

  if not v_done then
    return jsonb_build_object('credited', false, 'reason', 'not_completed');
  end if;

  insert into public.daily_mission_claims (user_id, claim_date, mission_id, reward_type, reward_amount)
  values (v_uid, v_today, p_mission_id, v_type, v_amount)
  on conflict (user_id, claim_date, mission_id) do nothing;

  if not found then
    return jsonb_build_object('credited', false, 'reason', 'already_claimed');
  end if;

  if v_type = 'coins' then
    perform public.add_coins(v_amount, 'daily_mission');
  elsif v_type = 'xp' then
    v_credit := v_amount;
    select xp_boost_expires_at, total_xp into v_boost, v_total_xp
      from public.user_progress where user_id = v_uid;
    if v_boost is not null and v_boost > now() then
      v_credit := v_credit * 2;
    end if;
    v_new_total := coalesce(v_total_xp, 0) + v_credit;
    update public.user_progress
      set total_xp = v_new_total,
          daily_xp = coalesce(daily_xp, 0) + v_credit,
          league   = case
                       when v_new_total >= 5000 then 'Diamante'
                       when v_new_total >= 2500 then 'Ouro'
                       when v_new_total >= 1000 then 'Prata'
                       else 'Bronze'
                     end
      where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'credited', true, 'mission_id', p_mission_id, 'reward_type', v_type, 'reward_amount', v_amount
  );
end;
$$;

revoke all on function public.claim_daily_bonus() from public;
grant execute on function public.claim_daily_bonus() to authenticated;
revoke all on function public.claim_daily_mission(text) from public;
grant execute on function public.claim_daily_mission(text) to authenticated;
