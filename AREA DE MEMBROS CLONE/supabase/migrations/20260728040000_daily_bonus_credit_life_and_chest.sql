-- Bônus Diário: liga as recompensas que a tela já promete mas não creditavam.
--   dia 4 "+1 ❤️"  → +1 vida (capado em 5)
--   dia 7 "BAÚ! 100" → 100 moedas (via add_coins, fonte única de moedas)
-- Idempotência por dia e demais tipos (coins/xp) inalterados.
-- Aplicado no remoto via MCP apply_migration (db push está bloqueado — ver
-- memoria gamificacao-persistencia-localstorage). Este arquivo é versionamento.
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  case v_slot
    when 1 then v_type := 'coins'; v_amount := 10;
    when 2 then v_type := 'xp';    v_amount := 15;
    when 3 then v_type := 'coins'; v_amount := 25;
    when 4 then v_type := 'life';  v_amount := 1;
    when 5 then v_type := 'coins'; v_amount := 50;
    when 6 then v_type := 'xp';    v_amount := 30;
    when 7 then v_type := 'chest'; v_amount := 100;
  end case;

  insert into public.daily_bonus_claims (user_id, claim_date, slot, reward_type, reward_amount)
  values (v_uid, v_today, v_slot, v_type, v_amount)
  on conflict (user_id, claim_date) do nothing;

  if not found then
    return jsonb_build_object('credited', false, 'reason', 'already_claimed');
  end if;

  if v_type = 'coins' then
    perform public.add_coins(v_amount, 'daily_bonus');
  elsif v_type = 'chest' then
    perform public.add_coins(v_amount, 'daily_bonus_chest');
  elsif v_type = 'life' then
    update public.user_progress
      set lives = least(coalesce(lives, 0) + v_amount, 5)
      where user_id = v_uid;
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
    'credited', true, 'slot', v_slot, 'reward_type', v_type, 'reward_amount', v_amount
  );
end;
$function$;
