-- =============================================================================
-- RPC: public.vagas_disponiveis()
-- Retorna quantas vagas ainda estão disponíveis (de um cap fixo de 100).
-- Uma vaga = um email em public.enrolled_emails (alimentado pelo webhook
-- da Eduzz quando o pagamento é aprovado).
--
-- Exposta pra o anon (página de vendas) sem revelar a lista de emails:
-- a função é SECURITY DEFINER, executa com o owner, e só retorna um inteiro.
-- =============================================================================

create or replace function public.vagas_disponiveis()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(
    0,
    100 - (select count(*)::int from public.enrolled_emails)
  );
$$;

-- Permite anon e authenticated chamarem a função
revoke all on function public.vagas_disponiveis() from public;
grant execute on function public.vagas_disponiveis() to anon, authenticated;

comment on function public.vagas_disponiveis() is
  'Retorna max(0, 100 - count(enrolled_emails)). Usada pela página de vendas pra mostrar vagas restantes sem expor a lista de emails. Quando retorna 0, a página entra em modo lista de espera.';
