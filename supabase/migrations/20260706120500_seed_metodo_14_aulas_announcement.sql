-- Seed do aviso "14 aulas novas no Método Completo" (idempotente).
-- Alvo: quem tem acesso ao produto Método Completo (o "grupo") e já existia
-- quando o aviso foi criado. Visto 1x, no próximo login.
insert into public.announcements
  (key, title, body, emoji, cta_label, cta_route, target_product_id, existing_users_only, active)
values (
  'metodo-completo-14-novas-aulas-2026-07',
  '14 aulas novas no Método Completo!',
  'Acabei de adicionar 14 aulas novas no seu módulo do Método Completo — de ajeitar o banco do jeito certo até o que fazer na hora H da prova. Já está tudo liberado pra você. Bora assistir? 💛',
  '🚗',
  'Ver as aulas novas',
  '/curso/63ed81e2-3658-4538-bfca-f44a24a60776',
  '63ed81e2-3658-4538-bfca-f44a24a60776',
  true,
  true
)
on conflict (key) do nothing;
