-- Índice pra consulta do painel /trafego (ads-stats filtra/ordena por enrolled_at).
-- Sem ele, cada atualização do painel varria a tabela inteira (desperdício de E/S
-- que contribuiu pro aviso de "disk IO budget" do Supabase em 23/07/2026).
create index if not exists idx_enrolled_emails_enrolled_at
  on public.enrolled_emails (enrolled_at desc);
