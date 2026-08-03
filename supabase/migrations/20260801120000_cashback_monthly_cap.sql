-- Teto TRANSPARENTE de resgate de cashback por mês (padrão R$10/mês).
-- Objetivo: controlar o custo do cashback (juntar R$25 leva ~3 meses) SEM esconder
-- a regra da aluna. As moedas não convertidas continuam na carteira (pra próximos
-- meses / futuro modo jogo) — só o "saque" em desconto é limitado por mês.
-- O app mostra a regra ("Resgate até R$10 por mês") e quanto resta no mês.

alter table public.cashback_config
  add column if not exists monthly_cap_brl numeric not null default 10;
update public.cashback_config set monthly_cap_brl = 10 where id = 1;

create or replace function public.convert_coins_to_coupon(p_coins_amount integer)
 returns table(code text, value_brl numeric, expires_at timestamp with time zone, remaining_coins integer)
 language plpgsql
 security definer
 set search_path = public
as $function$
DECLARE
  v_user_id    uuid := auth.uid();
  v_coins      int;
  v_config     RECORD;
  v_value      numeric;
  v_code       text;
  v_expires    timestamptz;
  v_used_month numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_config FROM public.cashback_config WHERE id = 1;

  IF p_coins_amount < v_config.min_coins_to_convert THEN
    RAISE EXCEPTION 'below_minimum: required %', v_config.min_coins_to_convert;
  END IF;

  SELECT coins INTO v_coins FROM public.user_progress WHERE user_id = v_user_id;
  IF v_coins IS NULL OR v_coins < p_coins_amount THEN
    RAISE EXCEPTION 'insufficient_coins: have %, need %', COALESCE(v_coins, 0), p_coins_amount;
  END IF;

  v_value := ROUND(p_coins_amount::numeric / v_config.coins_per_brl, 2);

  -- Teto mensal de RESGATE (só afeta a conversão em desconto; moedas ficam na carteira).
  -- Mês no fuso de Brasília.
  SELECT COALESCE(SUM(value_brl), 0) INTO v_used_month
  FROM public.discount_coupons
  WHERE user_id = v_user_id
    AND (created_at AT TIME ZONE 'America/Sao_Paulo') >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'));

  IF v_used_month + v_value > v_config.monthly_cap_brl + 0.001 THEN
    RAISE EXCEPTION 'monthly_cap_reached: cap=% used=%', v_config.monthly_cap_brl, v_used_month;
  END IF;

  v_expires := now() + (v_config.validity_days || ' days')::interval;
  v_code := 'MDDNM-' || UPPER(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  UPDATE public.user_progress SET coins = coins - p_coins_amount WHERE user_id = v_user_id;
  INSERT INTO public.discount_coupons (user_id, code, value_brl, coins_spent, expires_at)
    VALUES (v_user_id, v_code, v_value, p_coins_amount, v_expires);

  code := v_code;
  value_brl := v_value;
  expires_at := v_expires;
  remaining_coins := v_coins - p_coins_amount;
  RETURN NEXT;
END;
$function$;
