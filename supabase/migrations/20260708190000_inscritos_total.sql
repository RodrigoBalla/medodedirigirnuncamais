-- RPC pública p/ a página de vendas saber o nº REAL de alunas (distinct users
-- com acesso) — sem clamp. Substitui vagas_disponiveis() no sales.html, que
-- usava enrolled_emails (260, poluído com compras/leads) e mostrava "esgotado".
--   sales.html: turma 1 (<100) · turma 2 (100–199, conta 100→200) · comemora ao bater 100.
create or replace function public.inscritos_total()
returns integer language sql security definer set search_path = public stable
as $$ select count(distinct user_id)::int from public.access_group_users; $$;
revoke all on function public.inscritos_total() from public;
grant execute on function public.inscritos_total() to anon, authenticated;
comment on function public.inscritos_total() is 'Nº de ALUNAS com acesso (distinct access_group_users.user_id). Fonte do contador da sales.html (turma 1/2 + comemoração dos 100).';
