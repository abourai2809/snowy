create extension if not exists pgcrypto;

do $$
begin
  create type public.queuebuster_job_type as enum (
    'audit_flavour',
    'add_flavour',
    'fix_flavour',
    'catalog_products_check',
    'download_pos_csv',
    'reconcile_pos',
    'attendance_alert_check'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.queuebuster_job_status as enum (
    'pending',
    'running',
    'needs_confirmation',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.queuebuster_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type public.queuebuster_job_type not null,
  status public.queuebuster_job_status not null default 'pending',
  instruction text,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  audit_job_id uuid references public.queuebuster_jobs(id) on delete set null,
  requested_by uuid references public.users(id) on delete set null,
  confirmed_by uuid references public.users(id) on delete set null,
  confirmed_at timestamptz,
  claimed_by text,
  claimed_at timestamptz,
  run_started_at timestamptz,
  run_completed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.queuebuster_jobs
add column if not exists job_type public.queuebuster_job_type,
add column if not exists status public.queuebuster_job_status default 'pending',
add column if not exists instruction text,
add column if not exists request_payload jsonb default '{}'::jsonb,
add column if not exists result_payload jsonb,
add column if not exists audit_job_id uuid references public.queuebuster_jobs(id) on delete set null,
add column if not exists requested_by uuid references public.users(id) on delete set null,
add column if not exists confirmed_by uuid references public.users(id) on delete set null,
add column if not exists confirmed_at timestamptz,
add column if not exists claimed_by text,
add column if not exists claimed_at timestamptz,
add column if not exists run_started_at timestamptz,
add column if not exists run_completed_at timestamptz,
add column if not exists attempts integer default 0,
add column if not exists last_error text,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

alter table public.queuebuster_jobs
alter column job_type type public.queuebuster_job_type using job_type::text::public.queuebuster_job_type,
alter column status type public.queuebuster_job_status using status::text::public.queuebuster_job_status,
alter column request_payload type jsonb using request_payload::jsonb,
alter column attempts type integer using attempts::integer;

-- The table may already exist from an earlier partial setup. Backfill required
-- fields so the constraints below can be applied idempotently.
update public.queuebuster_jobs
set job_type = coalesce(job_type, 'audit_flavour'::public.queuebuster_job_type),
    status = coalesce(status, 'pending'::public.queuebuster_job_status),
    request_payload = coalesce(request_payload, '{}'::jsonb),
    attempts = coalesce(attempts, 0),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

alter table public.queuebuster_jobs
alter column job_type set not null,
alter column status set not null,
alter column status set default 'pending',
alter column request_payload set not null,
alter column request_payload set default '{}'::jsonb,
alter column attempts set not null,
alter column attempts set default 0,
alter column created_at set not null,
alter column created_at set default now(),
alter column updated_at set not null,
alter column updated_at set default now();

do $$
begin
  alter table public.queuebuster_jobs
  add constraint queuebuster_jobs_attempts_nonnegative
  check (attempts >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.queuebuster_jobs
  add constraint queuebuster_jobs_mutations_have_audit
  check (
    job_type not in ('add_flavour','fix_flavour')
    or audit_job_id is not null
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.queuebuster_jobs
  add constraint queuebuster_jobs_mutations_confirmed_before_run
  check (
    job_type not in ('add_flavour','fix_flavour')
    or status in ('needs_confirmation','cancelled','failed')
    or (confirmed_by is not null and confirmed_at is not null)
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.queuebuster_job_events (
  id uuid primary key default gen_random_uuid(),
  queuebuster_job_id uuid not null references public.queuebuster_jobs(id) on delete cascade,
  event_type text not null,
  status public.queuebuster_job_status not null,
  message text,
  safe_payload jsonb,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.queuebuster_job_events
add column if not exists queuebuster_job_id uuid references public.queuebuster_jobs(id) on delete cascade,
add column if not exists event_type text,
add column if not exists status public.queuebuster_job_status default 'pending',
add column if not exists message text,
add column if not exists safe_payload jsonb,
add column if not exists actor_id uuid references public.users(id) on delete set null,
add column if not exists created_at timestamptz default now();

alter table public.queuebuster_job_events
alter column status type public.queuebuster_job_status using status::text::public.queuebuster_job_status,
alter column safe_payload type jsonb using safe_payload::jsonb;

update public.queuebuster_job_events
set event_type = coalesce(event_type, 'created'),
    status = coalesce(status, 'pending'::public.queuebuster_job_status),
    created_at = coalesce(created_at, now());

alter table public.queuebuster_job_events
alter column queuebuster_job_id set not null,
alter column event_type set not null,
alter column status set not null,
alter column created_at set not null,
alter column created_at set default now();

create index if not exists queuebuster_jobs_status_created_idx
on public.queuebuster_jobs(status, created_at);

create index if not exists queuebuster_jobs_type_created_idx
on public.queuebuster_jobs(job_type, created_at desc);

create index if not exists queuebuster_job_events_job_idx
on public.queuebuster_job_events(queuebuster_job_id, created_at);

create or replace function public.claim_next_queuebuster_job(worker_id text)
returns setof public.queuebuster_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  if worker_id is null or btrim(worker_id) = '' then
    raise exception 'Worker id is required.';
  end if;

  update public.queuebuster_jobs
  set status = 'running'::public.queuebuster_job_status,
      claimed_by = worker_id,
      claimed_at = now(),
      run_started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  where id = (
    select id
    from public.queuebuster_jobs
    where status = 'pending'::public.queuebuster_job_status
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning id into claimed_id;

  if claimed_id is null then
    return;
  end if;

  insert into public.queuebuster_job_events (
    queuebuster_job_id,
    event_type,
    status,
    message,
    safe_payload
  )
  values (
    claimed_id,
    'claimed',
    'running'::public.queuebuster_job_status,
    'Claimed by worker.',
    jsonb_build_object('workerId', worker_id)
  );

  return query
  select *
  from public.queuebuster_jobs
  where id = claimed_id;
end;
$$;

alter table public.queuebuster_jobs enable row level security;
alter table public.queuebuster_job_events enable row level security;

drop policy if exists "queuebuster jobs readable by admin" on public.queuebuster_jobs;
create policy "queuebuster jobs readable by admin"
on public.queuebuster_jobs for select to authenticated
using (public.is_admin());

drop policy if exists "queuebuster jobs created by admin" on public.queuebuster_jobs;
create policy "queuebuster jobs created by admin"
on public.queuebuster_jobs for insert to authenticated
with check (public.is_admin());

drop policy if exists "queuebuster jobs updated by admin" on public.queuebuster_jobs;
create policy "queuebuster jobs updated by admin"
on public.queuebuster_jobs for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "queuebuster job events readable by admin" on public.queuebuster_job_events;
create policy "queuebuster job events readable by admin"
on public.queuebuster_job_events for select to authenticated
using (public.is_admin());

drop policy if exists "queuebuster job events created by admin" on public.queuebuster_job_events;
create policy "queuebuster job events created by admin"
on public.queuebuster_job_events for insert to authenticated
with check (public.is_admin());

grant select, insert, update, delete on public.queuebuster_jobs to authenticated;
grant select, insert, update, delete on public.queuebuster_job_events to authenticated;
grant all privileges on public.queuebuster_jobs to service_role;
grant all privileges on public.queuebuster_job_events to service_role;

revoke execute on function public.claim_next_queuebuster_job(text) from public, anon, authenticated;
grant execute on function public.claim_next_queuebuster_job(text) to service_role;
