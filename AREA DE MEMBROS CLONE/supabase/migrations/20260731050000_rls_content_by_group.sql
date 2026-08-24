-- ════════════════════════════════════════════════════════════════════════════
-- Fecha o acesso ao CONTEÚDO (modules/lessons) por posse de grupo + acesso ativo.
--
-- ANTES: policy SELECT era `product.status='published'` pro papel `public` — ou
-- seja, QUALQUER pessoa (até deslogada) lia todas as aulas/IDs de vídeo. O gate
-- real era só frontend + DRM do Panda.
--
-- DEPOIS: aluna só lê modules/lessons de produto publicado ao qual ela tem
-- acesso via grupo (access_group_users) E cujo access_status não é 'expired'.
-- Admin vê tudo. Isso fecha 3 buracos de uma vez:
--   • não-comprador não lê conteúdo que não comprou;
--   • reembolsado/expirado não lê nada;
--   • upsell represado (drip 7d) não é acessível antes de liberar (a aluna ainda
--     não está em access_group_users daquele grupo).
--
-- Metadados de catálogo (products) continuam legíveis (published) — necessário
-- pra biblioteca/telas de venda. Só o conteúdo (modules/lessons) fica fechado.
--
-- Validado antes de aplicar: dono do Método vê 21/21 aulas dele e 0 dos upsells;
-- reembolsado vê 0 de tudo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── LESSONS ──
drop policy if exists "Students see lessons of published products only" on public.lessons;
create policy "Students see lessons of owned published products, admin all"
on public.lessons for select
using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
  or exists (
    select 1
    from public.modules m
    join public.products p on p.id = m.product_id
    join public.access_group_products agp on agp.product_id = p.id
    join public.access_group_users agu on agu.group_id = agp.group_id and agu.user_id = auth.uid()
    left join public.profiles pr on pr.user_id = auth.uid()
    where m.id = lessons.module_id
      and p.status = 'published'
      and coalesce(pr.access_status, 'active') <> 'expired'
  )
);

-- ── MODULES ──
drop policy if exists "Students see modules of published products only" on public.modules;
create policy "Students see modules of owned published products, admin all"
on public.modules for select
using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
  or exists (
    select 1
    from public.products p
    join public.access_group_products agp on agp.product_id = p.id
    join public.access_group_users agu on agu.group_id = agp.group_id and agu.user_id = auth.uid()
    left join public.profiles pr on pr.user_id = auth.uid()
    where p.id = modules.product_id
      and p.status = 'published'
      and coalesce(pr.access_status, 'active') <> 'expired'
  )
);
