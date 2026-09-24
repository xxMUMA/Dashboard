create extension if not exists pgcrypto;

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  query text not null check (char_length(query) between 1 and 200),
  platform text not null check (platform in ('bluesky', 'x')),
  days smallint not null check (days in (1, 7)),
  mentions_count integer not null default 0 check (mentions_count >= 0),
  total_engagement bigint not null default 0 check (total_engagement >= 0),
  searched_at timestamptz not null default now()
);

create table if not exists public.mentions (
  id bigint generated always as identity primary key,
  search_id uuid not null references public.searches(id) on delete cascade,
  external_id text not null,
  platform text not null check (platform in ('bluesky', 'x')),
  author text not null,
  handle text not null,
  avatar_url text,
  content text not null,
  published_at timestamptz not null,
  likes integer not null default 0 check (likes >= 0),
  replies integer not null default 0 check (replies >= 0),
  reposts integer not null default 0 check (reposts >= 0),
  quotes integer not null default 0 check (quotes >= 0),
  post_url text not null,
  saved_at timestamptz not null default now(),
  unique (search_id, external_id)
);

create index if not exists searches_searched_at_idx
  on public.searches (searched_at desc);

create index if not exists mentions_search_id_idx
  on public.mentions (search_id);

create index if not exists mentions_published_at_idx
  on public.mentions (published_at desc);

alter table public.searches enable row level security;
alter table public.mentions enable row level security;

revoke all on table public.searches from anon, authenticated;
revoke all on table public.mentions from anon, authenticated;
grant all on table public.searches to service_role;
grant all on table public.mentions to service_role;
grant usage, select on sequence public.mentions_id_seq to service_role;
