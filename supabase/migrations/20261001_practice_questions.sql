-- AI-generated practice scenarios, and the admin allowlist that gates publishing
-- them.
--
-- Run this once in the Supabase SQL editor. Safe to re-run: every statement is
-- idempotent.
--
-- Why a table at all, when the other 19 scenarios are hardcoded in
-- src/data/practiceScenarios.js: those are hand-authored and ship in the bundle.
-- These are generated daily by .github/workflows/generate-questions.yml, and a
-- bundled array cannot grow without a rebuild. A table lets a new question reach
-- a student on their next page load.
--
-- Nothing here is written by the browser. The generator authenticates with the
-- service-role key, which bypasses RLS. Students read published rows; admins
-- move rows between states. There is deliberately no INSERT policy, so no
-- client can invent content by any route.

create table if not exists public.practice_questions (
  -- Set by the generator as gen-<YYYYMMDD>-<topicId>-<nn>. A re-run the same
  -- day skips topics it already covered and stops at the daily limit, so a
  -- retried job cannot duplicate its output — and can never reset a row an
  -- admin has already reviewed.
  id            text primary key,

  subject       text not null,
  level         text not null,

  -- `topic` is the free-text label the attribution rule resolves
  -- (resolveContentRef in src/data/syllabus.js). `topic_id` is the canonical id
  -- the generator resolved it to, stored so coverage queries never have to
  -- re-run the resolver over free text.
  topic         text not null,
  topic_id      text not null,
  topics        text[],

  -- Scenario difficulty is a NUMBER 1-3. This is not the examBank convention
  -- ('Easy' | 'Medium' | 'Hard') and mixing the two silently breaks the
  -- workboard's difficulty display, so the column is constrained here rather
  -- than trusted from the model.
  difficulty    integer not null check (difficulty between 1 and 3),

  source        text,
  total_marks   integer not null,
  stem          text not null,
  parts         jsonb not null,
  mark_scheme   jsonb not null,

  -- pending    generated, awaiting review
  -- published  approved, visible to students
  -- rejected   failed verification, or rejected in /admin
  status        text not null default 'pending'
                  check (status in ('pending', 'published', 'rejected')),

  -- Why a question was rejected, so the queue can explain itself instead of
  -- dropping content silently. Set by the numeric verification pass and by
  -- /admin.
  reject_reason text,

  run_id        text,
  generated_at  timestamptz not null default now(),
  published_at  timestamptz,
  reviewed_at   timestamptz
);

create index if not exists practice_questions_status_idx
  on public.practice_questions (status);

-- Coverage ranking walks this on every generator run: thinnest topics first.
create index if not exists practice_questions_topic_status_idx
  on public.practice_questions (subject, topic_id, status);

-- ── Admin allowlist ──────────────────────────────────────────────────────────
-- This replaces the hardcoded `CORRECT_PIN = 'EduAdmin24'` that used to guard
-- /admin. A PIN in the client bundle is not a boundary: it shipped in source
-- and was printed on the admin screen. Publishing a question makes it visible to
-- every student, so "is this caller an admin" has to be a fact the database
-- enforces.
--
-- There is no INSERT policy on this table. Rows are added by hand in the SQL
-- editor, so a compromised session cannot promote itself.
create table if not exists public.content_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER because this is called from RLS policies on another table.
-- Without it, evaluating the policy would re-enter RLS on content_admins from
-- inside a policy and recurse. search_path is pinned so a poisoned schema
-- cannot be substituted for the table name.
create or replace function public.is_content_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.content_admins a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_content_admin() from public;
grant execute on function public.is_content_admin() to authenticated;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- RLS is not enabled by default on a new table. Until it is, these policies do
-- nothing and the table is either world-readable or invisible.
alter table public.practice_questions enable row level security;
alter table public.content_admins enable row level security;

-- Students see published questions and nothing else. Not "not pending" — a
-- rejected question must be invisible, and the policy is written that way so a
-- future status cannot accidentally become visible by omission.
drop policy if exists "practice_questions_select_published" on public.practice_questions;
create policy "practice_questions_select_published"
  on public.practice_questions
  for select
  to authenticated
  using (status = 'published' or public.is_content_admin());

-- Approve / reject. Reading the pending queue is the select policy above; this
-- is the only write a client may perform, and only an admin may perform it.
drop policy if exists "practice_questions_admin_update" on public.practice_questions;
create policy "practice_questions_admin_update"
  on public.practice_questions
  for update
  to authenticated
  using (public.is_content_admin())
  with check (public.is_content_admin());

-- No INSERT policy, and no DELETE policy. Content is created by the generator
-- (service role) and retired by marking it rejected, not by removing history.
-- Deleting a published question would also be a silent edit of what a student
-- was served, which is exactly what this table must not allow.

-- An admin may read their own row so the client can tell whether to render the
-- panel, and nobody may read anyone else's.
drop policy if exists "content_admins_select_own" on public.content_admins;
create policy "content_admins_select_own"
  on public.content_admins
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── Make yourself an admin ───────────────────────────────────────────────────
-- Sign in once, then run this in the SQL editor. Get your id from the Auth
-- dashboard, or:
--   select id, email from auth.users where email = 'you@example.com';
--
-- insert into public.content_admins (user_id)
-- values ('<your-user-id>')
-- on conflict (user_id) do nothing;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expected: both tables report "Enabled", and is_content_admin() returns true
-- for your own session only.
select relname, relrowsecurity
from pg_class
where relname in ('practice_questions', 'content_admins');
