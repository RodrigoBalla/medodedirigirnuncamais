-- RPC pública p/ a página de vendas saber o nº REAL de alunas (distinct users
-- com acesso) — sem clamp. Substitui vagas_disponiveis() no sales.html, que
-- usava enrolled_emails (260, poluído com compras/leads) e mostrava "esgotado".
--   sales.html: turma 1 (<100) · turma 2 (100–199, conta 100→200) · comemora ao bater 100.
-- Conta ALUNAS reais (mesmas exclusões do vagas_disponiveis: admin, Carla e
-- emails de teste), SEM clamp — pra saber a turma (100→200). inscritos_total +
-- vagas_disponiveis = 100 na turma 1.
create or replace function public.inscritos_total()
returns integer language sql security definer set search_path = public stable
as $$
  select count(distinct agu.user_id)::int
  from public.access_group_users agu
  join auth.users u on u.id = agu.user_id
  where not exists (select 1 from public.user_roles ur where ur.user_id = agu.user_id and ur.role = 'admin')
    and u.email <> 'joautoescola@gmail.com'
    and u.email not like '%@mddnm.test'
    and u.email not like 'test-%'
    and u.email not like 'teste-%';
$$;
revoke all on function public.inscritos_total() from public;
grant execute on function public.inscritos_total() to anon, authenticated;
comment on function public.inscritos_total() is 'Nº de ALUNAS com acesso (distinct access_group_users.user_id). Fonte do contador da sales.html (turma 1/2 + comemoração dos 100).';
