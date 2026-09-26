-- Cross-device practice progress.
--
-- Run this once in the Supabase SQL editor. Until it is run, practice attempts
-- still record and display perfectly on the device that made them — they simply
-- do not follow the student to another device, and the sync queue retries them
-- in the background (giving up after 8 tries, with a note in the console).
--
-- Safe to re-run: every statement is idempotent.

create table if not exists public.practice_attempts (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  subject      text,
  topic_id     text,
  chapter_id   text,
  topic_name   text,
  score        numeric not null default 0,
  duration_min integer not null default 0,
  recorded_at  timestamptz not null default now()
);

-- The client generates `id` so the same attempt can be retried and de-duplicated
-- without ever producing a second row. This is what makes an offline attempt
-- safe to sync more than once.
create unique index if not exists practice_attempts_pkey on public.practice_attempts (id);

create index if not exists practice_attempts_user_recorded_idx
  on public.practice_attempts (user_id, recorded_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Without these the table is either world-readable or invisible: RLS is not
-- enabled by default on a new table, and until it is, the policies below do
-- nothing. Students must only ever see their own attempts.
alter table public.practice_attempts enable row level security;

drop policy if exists "practice_attempts_select_own" on public.practice_attempts;
create policy "practice_attempts_select_own"
  on public.practice_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "practice_attempts_insert_own" on public.practice_attempts;
create policy "practice_attempts_insert_own"
  on public.practice_attempts
  for insert
  with check (auth.uid() = user_id);

-- No update or delete policy on purpose. Practice history is append-only: a
-- student cannot edit a score they already earned. Their own attempt can still
-- be removed via the cascade when their account is deleted.

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expected: "Row Level Security: Enabled" and both policies present.
select relname, relrowsecurity
from pg_class
where relname = 'practice_attempts';
