-- =============================================================================
-- COMUNIDADE
-- Posts (texto), curtidas e itens salvos. Cada usuário autenticado lê tudo,
-- mas só escreve em nome próprio (RLS). Sem comments por enquanto (V2).
-- =============================================================================

-- ── Tabela de posts ─────────────────────────────────────────────────────────
create table public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  is_question boolean not null default false,
  category    text not null default 'feed' check (category in ('feed','mentorias','dicas')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index community_posts_created_at_idx on public.community_posts (created_at desc);
create index community_posts_user_id_idx    on public.community_posts (user_id);
create index community_posts_category_idx   on public.community_posts (category);

-- ── Curtidas (1 por usuário por post) ──────────────────────────────────────
create table public.community_likes (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index community_likes_user_id_idx on public.community_likes (user_id);

-- ── Salvos (bookmarks pessoais) ────────────────────────────────────────────
create table public.community_saves (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index community_saves_user_id_idx on public.community_saves (user_id);

-- ── Trigger updated_at ─────────────────────────────────────────────────────
create or replace function public.community_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger community_posts_touch_updated_at
  before update on public.community_posts
  for each row execute function public.community_touch_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_saves enable row level security;

-- Posts: todo usuário autenticado lê; só escreve/edita/deleta os próprios
create policy "community_posts_read_authenticated"
  on public.community_posts for select
  to authenticated using (true);

create policy "community_posts_insert_own"
  on public.community_posts for insert
  to authenticated with check (auth.uid() = user_id);

create policy "community_posts_update_own"
  on public.community_posts for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "community_posts_delete_own"
  on public.community_posts for delete
  to authenticated using (auth.uid() = user_id);

-- Likes: leitura aberta a autenticados (pra mostrar contagens), escrita só própria
create policy "community_likes_read_authenticated"
  on public.community_likes for select
  to authenticated using (true);

create policy "community_likes_insert_own"
  on public.community_likes for insert
  to authenticated with check (auth.uid() = user_id);

create policy "community_likes_delete_own"
  on public.community_likes for delete
  to authenticated using (auth.uid() = user_id);

-- Saves: privados — usuário só vê/escreve os próprios
create policy "community_saves_read_own"
  on public.community_saves for select
  to authenticated using (auth.uid() = user_id);

create policy "community_saves_insert_own"
  on public.community_saves for insert
  to authenticated with check (auth.uid() = user_id);

create policy "community_saves_delete_own"
  on public.community_saves for delete
  to authenticated using (auth.uid() = user_id);

-- Realtime: emitir mudanças de posts pro frontend (novos posts aparecem ao vivo)
alter publication supabase_realtime add table public.community_posts;

comment on table public.community_posts is 'Posts da comunidade. RLS: lê autenticado, escreve só dono.';
comment on table public.community_likes is 'Curtidas. (post_id, user_id) único.';
comment on table public.community_saves is 'Bookmarks privados. Só dono lê/escreve.';
