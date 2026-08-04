-- Papel restrito "support": vê o /admin em LEITURA + responde mensagens dos alunos.
-- NUNCA edita (toda escrita continua admin-only via RLS/RPCs). A liberação de
-- leitura/mensagens vem na migration 20260803091000. Enum add em txn separada.
alter type public.app_role add value if not exists 'support';
