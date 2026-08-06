-- inputtv schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

-- ============================================================ catalog

create table if not exists languages (
  code text primary key,           -- BCP-47-ish: 'es', 'pt', 'it', 'fr', 'ja'
  name text not null,
  flag text not null default ''
);

create table if not exists channels (
  id text primary key,             -- YouTube channel ID (UC...)
  handle text unique,              -- '@DreamingSpanish' — ingest resolves id from this
  language_code text not null references languages(code),
  name text not null default '',
  is_ci_channel boolean not null default true,
  level_prior numeric,             -- 1..7, used as the level heuristic until the ML leveler exists
  last_ingested_at timestamptz
);

create table if not exists videos (
  id text primary key,             -- YouTube video ID
  channel_id text not null references channels(id) on delete cascade,
  language_code text not null references languages(code),
  title text not null,
  channel_name text not null default '',
  description text not null default '',
  duration_seconds int not null default 0,
  published_at timestamptz,
  thumbnail_url text not null default '',
  embeddable boolean not null default true,
  available boolean not null default true,  -- false when deleted/privated upstream
  view_count bigint not null default 0,
  level int not null default 4 check (level between 1 and 7),
  level_confidence numeric not null default 0.3,
  wpm numeric,
  top1k_coverage numeric,
  top5k_coverage numeric,
  transcript_status text not null default 'none', -- none | fetched | unavailable
  metadata_refreshed_at timestamptz not null default now()
);

create index if not exists videos_feed_idx
  on videos (language_code, level, published_at desc)
  where embeddable and available;

-- ============================================================ per-user

create table if not exists user_language_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null references languages(code),
  current_level int not null default 2 check (current_level between 1 and 7),
  total_seconds_watched bigint not null default 0,
  daily_goal_minutes int not null default 30,
  created_at timestamptz not null default now(),
  primary key (user_id, language_code)
);

create table if not exists watch_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null references videos(id) on delete cascade,
  language_code text not null references languages(code),
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  seconds_watched numeric not null default 0,
  max_position numeric not null default 0,
  completed boolean not null default false
);

create index if not exists watch_sessions_user_idx on watch_sessions (user_id, started_at desc);

create table if not exists daily_watch_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null references languages(code),
  day date not null,
  seconds_watched int not null default 0,
  primary key (user_id, language_code, day)
);

-- ============================================================ RLS

alter table languages enable row level security;
alter table channels enable row level security;
alter table videos enable row level security;
alter table user_language_profiles enable row level security;
alter table watch_sessions enable row level security;
alter table daily_watch_stats enable row level security;

-- catalog is world-readable; only the service role (ingest script) writes it
create policy "languages readable" on languages for select using (true);
create policy "channels readable" on channels for select using (true);
create policy "videos readable" on videos for select using (true);

create policy "own profile all" on user_language_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sessions read" on watch_sessions
  for select using (auth.uid() = user_id);

create policy "own stats read" on daily_watch_stats
  for select using (auth.uid() = user_id);

-- Sessions and stats are only *written* through the RPCs below,
-- so no insert/update policies for authenticated users.

-- ============================================================ RPCs

-- Opens a watch session. Called once when the player mounts.
create or replace function start_watch_session(p_video_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lang text;
  v_session uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select language_code into v_lang from videos where id = p_video_id;
  if v_lang is null then
    raise exception 'unknown video';
  end if;

  insert into watch_sessions (user_id, video_id, language_code)
  values (auth.uid(), p_video_id, v_lang)
  returning id into v_session;

  return v_session;
end;
$$;

-- Records watched seconds with server-side validation:
-- the reported delta can never exceed wall-clock time since the last heartbeat.
create or replace function record_heartbeat(
  p_session_id uuid,
  p_seconds numeric,
  p_max_position numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session watch_sessions%rowtype;
  v_wall numeric;
  v_credit numeric;
  v_duration int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_session
  from watch_sessions
  where id = p_session_id and user_id = auth.uid()
  for update;

  if v_session.id is null then
    raise exception 'unknown session';
  end if;

  -- wall-clock elapsed since last heartbeat, plus a small grace for latency
  v_wall := extract(epoch from (now() - v_session.last_heartbeat_at)) + 3;
  v_credit := least(greatest(p_seconds, 0), v_wall);
  if v_credit <= 0 then
    return;
  end if;

  select duration_seconds into v_duration from videos where id = v_session.video_id;

  update watch_sessions
  set seconds_watched   = seconds_watched + v_credit,
      max_position      = greatest(max_position, coalesce(p_max_position, 0)),
      last_heartbeat_at = now(),
      completed         = (v_duration > 0
                           and greatest(max_position, coalesce(p_max_position, 0)) >= v_duration * 0.9)
  where id = p_session_id;

  insert into daily_watch_stats (user_id, language_code, day, seconds_watched)
  values (auth.uid(), v_session.language_code, current_date, round(v_credit)::int)
  on conflict (user_id, language_code, day)
  do update set seconds_watched = daily_watch_stats.seconds_watched + excluded.seconds_watched;

  update user_language_profiles
  set total_seconds_watched = total_seconds_watched + round(v_credit)::int
  where user_id = auth.uid() and language_code = v_session.language_code;
end;
$$;

grant execute on function start_watch_session(text) to authenticated;
grant execute on function record_heartbeat(uuid, numeric, numeric) to authenticated;
