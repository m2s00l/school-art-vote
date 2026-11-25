-- Run once in Supabase SQL Editor AFTER the five v3 tables exist.
-- Uses the existing students, categories, artworks, votes and settings tables.
create extension if not exists pgcrypto;

create table if not exists public.app_sessions (
  token_hash text primary key,
  student_id uuid references public.students(id) on delete cascade,
  is_admin boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((is_admin and student_id is null) or (not is_admin and student_id is not null))
);
create index if not exists app_sessions_expires on public.app_sessions(expires_at);

create table if not exists public.vote_submissions (
  student_id uuid primary key references public.students(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

create table if not exists public.admin_login_attempts (
  source_hash text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.app_sessions enable row level security;
alter table public.vote_submissions enable row level security;
alter table public.admin_login_attempts enable row level security;
revoke all on public.app_sessions from anon, authenticated;
revoke all on public.vote_submissions from anon, authenticated;
revoke all on public.admin_login_attempts from anon, authenticated;

-- The Edge Function (service role) calls this routine to commit an ENTIRE ballot atomically.
-- It rejects duplicate submission, own-artwork votes, over-three-per-category,
-- incorrect categories, unpublished phase and repeated artwork ids.
create or replace function public.submit_art_ballot(
  p_student uuid,
  p_ballot jsonb
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_phase text;
  v_total integer;
  v_distinct integer;
  v_invalid integer;
  v_over integer;
begin
  if not exists(select 1 from students where id = p_student) then
    raise exception '등록되지 않은 학생입니다.';
  end if;
  select phase into v_phase from settings where id = 1 for share;
  if v_phase <> 'voting' then
    raise exception '현재 투표 기간이 아닙니다.';
  end if;
  if jsonb_typeof(p_ballot) is distinct from 'array' then
    raise exception '투표 형식이 올바르지 않습니다.';
  end if;
  select count(*), count(distinct value::text)
    into v_total, v_distinct
  from jsonb_array_elements_text(p_ballot);
  if v_total < 1 or v_total > 15 or v_total <> v_distinct then
    raise exception '투표 개수가 올바르지 않거나 중복된 작품이 있습니다.';
  end if;
  select count(*) into v_invalid
  from jsonb_array_elements_text(p_ballot) x(value)
  left join artworks a on a.id::text = x.value
  where a.id is null or a.student_id = p_student or (a.id is not null and not exists
    (select 1 from categories c where c.id = a.category_id));
  if v_invalid > 0 then
    raise exception '본인 작품이거나 존재하지 않는 작품이 포함되어 있습니다.';
  end if;
  select count(*) into v_over from (
    select a.category_id
    from jsonb_array_elements_text(p_ballot) x(value)
    join artworks a on a.id::text = x.value
    group by a.category_id having count(*) > 3
  ) over_limit;
  if v_over > 0 then
    raise exception '한 섹션에는 최대 3개까지 투표할 수 있습니다.';
  end if;
  -- Insert first: two simultaneous submissions for same student cannot both win.
  insert into vote_submissions(student_id) values(p_student);
  insert into votes(voter_id, artwork_id)
  select p_student, a.id
  from jsonb_array_elements_text(p_ballot) x(value)
  join artworks a on a.id::text = x.value;
end;
$$;
revoke all on function public.submit_art_ballot(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.submit_art_ballot(uuid,jsonb) to service_role;

-- The settings phase values in the original schema are:
-- registration, review, voting, closed, results.
