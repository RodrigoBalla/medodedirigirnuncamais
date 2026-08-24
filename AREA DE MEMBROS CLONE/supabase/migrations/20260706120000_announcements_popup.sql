-- ─────────────────────────────────────────────────────────────────────────────
-- Avisos (popup) na área de membros — broadcast do admin pras alunas, visto 1x.
--
-- Uma linha em `announcements` = um aviso. `announcement_reads` marca quem já
-- fechou. O "visto só uma vez" é SERVER-SIDE (não localStorage): vale entre
-- dispositivos e sobrevive a limpar cache — a aluna vê o aviso no PRÓXIMO login
-- e nunca mais.
--
-- Elegibilidade e "ainda-não-visto" resolvidos por RPC SECURITY DEFINER pra não
-- vazar aviso pra quem não é do grupo:
--   • target_product_id → só quem tem acesso a esse produto (o "grupo") vê.
--       null = todas as alunas.
--   • existing_users_only → só quem JÁ existia quando o aviso foi criado
--       (aluna que entrar depois já vê o conteúdo novo como padrão, não precisa
--        do aviso "tem aula nova").
--   • admin gerencia tudo; ninguém vê o read de ninguém.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,                 -- slug estável do aviso
  title text not null,
  body text not null,
  emoji text not null default '🎉',
  cta_label text,                           -- rótulo do botão (opcional)
  cta_route text,                           -- caminho interno react-router, ex: /curso/<id>
  cta_href text,                            -- OU url externa http(s); cta_route tem prioridade
  target_product_id uuid references public.products(id) on delete cascade, -- null = todas
  existing_users_only boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.announcements is
  'Avisos popup na área de membros (broadcast admin->alunas, visto 1x). Elegibilidade via get_pending_announcements().';

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- announcements: qualquer autenticado lê os ATIVOS (conteúdo não é sensível);
-- admin gerencia (create/update/delete) tudo.
drop policy if exists ann_select on public.announcements;
create policy ann_select on public.announcements
  for select to authenticated
  using (active or public._is_admin());

drop policy if exists ann_admin_all on public.announcements;
create policy ann_admin_all on public.announcements
  for all to authenticated
  using (public._is_admin()) with check (public._is_admin());

-- announcement_reads: aluna vê/insere só as PRÓPRIAS; admin vê tudo.
drop policy if exists annr_select on public.announcement_reads;
create policy annr_select on public.announcement_reads
  for select to authenticated
  using (user_id = auth.uid() or public._is_admin());

drop policy if exists annr_insert_self on public.announcement_reads;
create policy annr_insert_self on public.announcement_reads
  for insert to authenticated
  with check (user_id = auth.uid());

-- ─── RPC: avisos pendentes pra aluna logada (elegível + ainda não visto) ──────
create or replace function public.get_pending_announcements()
returns table(
  id uuid,
  key text,
  title text,
  body text,
  emoji text,
  cta_label text,
  cta_route text,
  cta_href text
)
language sql stable security definer set search_path to 'public'
as $$
  select a.id, a.key, a.title, a.body, a.emoji, a.cta_label, a.cta_route, a.cta_href
  from public.announcements a
  where a.active
    and auth.uid() is not null
    and not exists (
      select 1 from public.announcement_reads r
      where r.announcement_id = a.id and r.user_id = auth.uid()
    )
    and (
      a.target_product_id is null
      or exists (
        select 1
        from public.access_group_users agu
        join public.access_group_products agp on agp.group_id = agu.group_id
        where agu.user_id = auth.uid()
          and agp.product_id = a.target_product_id
      )
    )
    and (
      not a.existing_users_only
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.created_at < a.created_at
      )
    )
  order by a.created_at asc;
$$;

-- ─── RPC: aluna marca o aviso como visto (idempotente) ───────────────────────
create or replace function public.dismiss_announcement(p_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  insert into public.announcement_reads (announcement_id, user_id)
  values (p_id, auth.uid())
  on conflict (announcement_id, user_id) do nothing;
end;
$$;

revoke all on function public.get_pending_announcements() from public;
revoke all on function public.dismiss_announcement(uuid) from public;
grant execute on function public.get_pending_announcements() to authenticated;
grant execute on function public.dismiss_announcement(uuid) to authenticated;
