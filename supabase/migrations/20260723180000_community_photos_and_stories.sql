-- COMUNIDADE: fotos no feed + stories com expiração (24h).
-- Bucket 'community' público p/ leitura, 2 MB por arquivo, só imagem.
-- Escrita/remoção restrita à própria pasta (<uid>/...) via RLS no storage.
-- Limpeza dos stories vencidos: edge function cleanup-stories + pg_cron horário.
alter table public.community_posts add column if not exists image_url text;
alter table public.community_posts add column if not exists image_path text;

create table if not exists public.community_stories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  image_url    text not null,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '24 hours')
);
create index if not exists idx_stories_expires on public.community_stories (expires_at);
create index if not exists idx_stories_user_created on public.community_stories (user_id, created_at desc);
alter table public.community_stories enable row level security;

drop policy if exists "stories_select_active" on public.community_stories;
create policy "stories_select_active" on public.community_stories
  for select to authenticated using (expires_at > now());
drop policy if exists "stories_insert_own" on public.community_stories;
create policy "stories_insert_own" on public.community_stories
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "stories_delete_own" on public.community_stories;
create policy "stories_delete_own" on public.community_stories
  for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_read_public" on storage.objects;
create policy "community_read_public" on storage.objects
  for select using (bucket_id = 'community');
drop policy if exists "community_insert_own_folder" on storage.objects;
create policy "community_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "community_delete_own_folder" on storage.objects;
create policy "community_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.list_active_stories()
returns table(id uuid, user_id uuid, display_name text, image_url text,
              caption text, created_at timestamptz, expires_at timestamptz)
language sql security definer set search_path = public
as $$
  select s.id, s.user_id, coalesce(p.display_name, 'Aluna'), s.image_url,
         s.caption, s.created_at, s.expires_at
  from public.community_stories s
  left join public.profiles p on p.user_id = s.user_id
  where s.expires_at > now() and auth.uid() is not null
  order by s.created_at desc limit 200;
$$;

select cron.schedule('cleanup-stories-hourly', '10 * * * *', $$
  select net.http_post(
    url := 'https://qkvinhzwiptfobdvsdtr.supabase.co/functions/v1/cleanup-stories',
    headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb);
$$);
