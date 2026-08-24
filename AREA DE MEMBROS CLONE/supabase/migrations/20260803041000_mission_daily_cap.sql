-- Fecha a brecha das missões: teto DIÁRIO de moedas de missão + menos missões/ciclo.
-- Antes: missions_per_cycle=100 e só teto de 1500/30d => dava pra cunhar ~1500 moedas
-- numa única sessão clicando missões de honra (self_report). Agora: no máx.
-- daily_coin_cap moedas de missão por dia (fuso BR); missões por ciclo = 12.
alter table public.mission_config add column if not exists daily_coin_cap integer not null default 150;
update public.mission_config set daily_coin_cap = 150, missions_per_cycle = 12 where id = 1;

create or replace function public.claim_mission(p_user_mission_id uuid)
 returns table(ok boolean, granted_coins integer, total_balance integer)
 language plpgsql
 security definer
as $function$
DECLARE
  v_user_id        uuid := auth.uid();
  v_um             RECORD;
  v_mission        RECORD;
  v_cfg            RECORD;
  v_already_earned int;
  v_earned_today   int;
  v_remaining_cap  int;
  v_remaining_day  int;
  v_to_grant       int;
  v_expires        timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_cfg FROM public.mission_config WHERE id = 1;

  SELECT * INTO v_um FROM public.user_missions
    WHERE id = p_user_mission_id AND user_id = v_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_not_found'; END IF;
  IF v_um.completed_at IS NULL THEN RAISE EXCEPTION 'mission_not_completed'; END IF;
  IF v_um.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = v_um.mission_id;

  -- Teto por CICLO (já existia)
  SELECT COALESCE(SUM(rewarded_coins), 0) INTO v_already_earned
    FROM public.user_missions
    WHERE user_id = v_user_id AND cycle_start = v_um.cycle_start AND claimed_at IS NOT NULL;
  v_remaining_cap := GREATEST(v_cfg.max_coins_per_cycle - v_already_earned, 0);

  -- Teto DIÁRIO (novo) — moedas de missão ganhas hoje (fuso BR)
  SELECT COALESCE(SUM(amount), 0) INTO v_earned_today
    FROM public.coin_transactions
    WHERE user_id = v_user_id AND source = 'mission'
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_remaining_day := GREATEST(v_cfg.daily_coin_cap - v_earned_today, 0);

  -- Sem espaço no dia: NÃO queima a missão (pode resgatar amanhã).
  IF v_remaining_day <= 0 THEN
    RAISE EXCEPTION 'daily_cap_reached';
  END IF;

  v_to_grant := LEAST(v_mission.reward_coins, v_remaining_cap, v_remaining_day);

  UPDATE public.user_missions
    SET claimed_at = now(), rewarded_coins = v_to_grant
    WHERE id = p_user_mission_id;

  IF v_to_grant > 0 THEN
    v_expires := now() + (v_cfg.coin_expiry_days || ' days')::interval;
    INSERT INTO public.coin_transactions (user_id, amount, source, reference_id, description, expires_at)
      VALUES (v_user_id, v_to_grant, 'mission', v_mission.id, 'Missão: ' || v_mission.title, v_expires);
    UPDATE public.user_progress SET coins = COALESCE(coins, 0) + v_to_grant WHERE user_id = v_user_id;
  END IF;

  ok := true;
  granted_coins := v_to_grant;
  SELECT public.get_valid_coins_balance() INTO total_balance;
  RETURN NEXT;
END;
$function$;
