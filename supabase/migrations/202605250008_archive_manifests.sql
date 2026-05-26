create extension if not exists pgcrypto;

do $$
begin
  create type public.archive_manifest_status as enum (
    'dry_run',
    'planned',
    'uploaded',
    'verified',
    'delete_ready',
    'deleted',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.archive_manifest_mode as enum (
    'dry_run',
    'live'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.archive_manifests (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  environment text not null,
  mode public.archive_manifest_mode not null default 'dry_run',
  status public.archive_manifest_status not null default 'dry_run',
  window_start date not null,
  window_end date not null,
  candidate_source_count integer not null default 0,
  candidate_row_count bigint not null default 0,
  manifest_payload jsonb not null default '{}'::jsonb,
  manifest_local_path text,
  drive_folder_id text,
  drive_file_id text,
  checksum_sha256 text,
  code_version text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint archive_manifests_run_id_unique unique (run_id),
  constraint archive_manifests_window_valid check (window_end > window_start),
  constraint archive_manifests_source_count_nonnegative check (candidate_source_count >= 0),
  constraint archive_manifests_row_count_nonnegative check (candidate_row_count >= 0)
);

alter table public.archive_manifests
add column if not exists run_id text,
add column if not exists environment text,
add column if not exists mode public.archive_manifest_mode default 'dry_run',
add column if not exists status public.archive_manifest_status default 'dry_run',
add column if not exists window_start date,
add column if not exists window_end date,
add column if not exists candidate_source_count integer default 0,
add column if not exists candidate_row_count bigint default 0,
add column if not exists manifest_payload jsonb default '{}'::jsonb,
add column if not exists manifest_local_path text,
add column if not exists drive_folder_id text,
add column if not exists drive_file_id text,
add column if not exists checksum_sha256 text,
add column if not exists code_version text,
add column if not exists created_by uuid references public.users(id) on delete set null,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

update public.archive_manifests
set run_id = coalesce(run_id, id::text),
    environment = coalesce(environment, 'unknown'),
    mode = coalesce(mode, 'dry_run'::public.archive_manifest_mode),
    status = coalesce(status, 'dry_run'::public.archive_manifest_status),
    window_start = coalesce(window_start, current_date),
    window_end = coalesce(window_end, current_date + 1),
    candidate_source_count = coalesce(candidate_source_count, 0),
    candidate_row_count = coalesce(candidate_row_count, 0),
    manifest_payload = coalesce(manifest_payload, '{}'::jsonb),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

alter table public.archive_manifests
alter column run_id set not null,
alter column environment set not null,
alter column mode set not null,
alter column mode set default 'dry_run',
alter column status set not null,
alter column status set default 'dry_run',
alter column window_start set not null,
alter column window_end set not null,
alter column candidate_source_count set not null,
alter column candidate_source_count set default 0,
alter column candidate_row_count set not null,
alter column candidate_row_count set default 0,
alter column manifest_payload set not null,
alter column manifest_payload set default '{}'::jsonb,
alter column created_at set not null,
alter column created_at set default now(),
alter column updated_at set not null,
alter column updated_at set default now();

do $$
begin
  alter table public.archive_manifests
  add constraint archive_manifests_run_id_unique unique (run_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.archive_manifests
  add constraint archive_manifests_window_valid check (window_end > window_start);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.archive_manifests
  add constraint archive_manifests_source_count_nonnegative check (candidate_source_count >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.archive_manifests
  add constraint archive_manifests_row_count_nonnegative check (candidate_row_count >= 0);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.archive_files (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.archive_manifests(id) on delete cascade,
  source_table text not null,
  source_kind text not null default 'database_table',
  retention_class text not null,
  window_start date not null,
  window_end date not null,
  date_column text not null,
  predicate text not null,
  row_count bigint not null default 0,
  primary_key_hash text,
  schema_hash text,
  destination_provider text not null default 'google_drive',
  drive_folder_id text,
  drive_file_id text,
  drive_file_name text,
  byte_size bigint,
  sha256 text,
  verification_status text not null default 'not_uploaded',
  deletion_status text not null default 'not_started',
  deleted_row_count bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint archive_files_window_valid check (window_end > window_start),
  constraint archive_files_row_count_nonnegative check (row_count >= 0),
  constraint archive_files_byte_size_nonnegative check (byte_size is null or byte_size >= 0),
  constraint archive_files_deleted_row_count_nonnegative check (
    deleted_row_count is null or deleted_row_count >= 0
  )
);

alter table public.archive_files
add column if not exists manifest_id uuid references public.archive_manifests(id) on delete cascade,
add column if not exists source_table text,
add column if not exists source_kind text default 'database_table',
add column if not exists retention_class text,
add column if not exists window_start date,
add column if not exists window_end date,
add column if not exists date_column text,
add column if not exists predicate text,
add column if not exists row_count bigint default 0,
add column if not exists primary_key_hash text,
add column if not exists schema_hash text,
add column if not exists destination_provider text default 'google_drive',
add column if not exists drive_folder_id text,
add column if not exists drive_file_id text,
add column if not exists drive_file_name text,
add column if not exists byte_size bigint,
add column if not exists sha256 text,
add column if not exists verification_status text default 'not_uploaded',
add column if not exists deletion_status text default 'not_started',
add column if not exists deleted_row_count bigint,
add column if not exists metadata jsonb default '{}'::jsonb,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create index if not exists archive_manifests_window_idx
on public.archive_manifests(environment, window_start, window_end);

create index if not exists archive_files_manifest_idx
on public.archive_files(manifest_id);

create index if not exists archive_files_source_window_idx
on public.archive_files(source_table, window_start, window_end);

create or replace function public.archive_table_schema_hash(source_table text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    digest(
      coalesce(
        string_agg(
          c.ordinal_position::text || ':' || c.column_name || ':' || c.data_type || ':' || c.is_nullable,
          ','
          order by c.ordinal_position
        ),
        ''
      ),
      'sha256'
    ),
    'hex'
  )
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = $1
$$;

create or replace function public.build_archive_manifest_candidates(
  p_window_start date,
  p_window_end date
)
returns table (
  source_table text,
  source_kind text,
  retention_class text,
  window_start date,
  window_end date,
  date_column text,
  predicate text,
  row_count bigint,
  primary_key_hash text,
  schema_hash text,
  min_business_date date,
  max_business_date date,
  notes text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Admin access is required to build archive manifests.';
  end if;

  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'Archive window must have a start date before the end date.';
  end if;

  return query
  select 'pan_events'::text,
         'database_table'::text,
         'Supabase recent-window + Drive archive'::text,
         p_window_start,
         p_window_end,
         'recorded_at'::text,
         format('recorded_at >= %L and recorded_at < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('pan_events'),
         min(recorded_at)::date,
         max(recorded_at)::date,
         null::text
  from public.pan_events
  where recorded_at >= p_window_start
    and recorded_at < p_window_end

  union all
  select 'dispatches',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'dispatched_at',
         format('dispatched_at >= %L and dispatched_at < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('dispatches'),
         min(dispatched_at)::date,
         max(dispatched_at)::date,
         null::text
  from public.dispatches
  where dispatched_at >= p_window_start
    and dispatched_at < p_window_end

  union all
  select 'dispatch_items',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'dispatches.dispatched_at',
         format('parent dispatches.dispatched_at >= %L and < %L', p_window_start, p_window_end),
         count(di.*)::bigint,
         encode(digest(coalesce(string_agg(di.id::text, ',' order by di.id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('dispatch_items'),
         min(d.dispatched_at)::date,
         max(d.dispatched_at)::date,
         'Date window comes from parent dispatches.'::text
  from public.dispatch_items di
  join public.dispatches d on d.id = di.dispatch_id
  where d.dispatched_at >= p_window_start
    and d.dispatched_at < p_window_end

  union all
  select 'store_receipts',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'received_at',
         format('received_at >= %L and received_at < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('store_receipts'),
         min(received_at)::date,
         max(received_at)::date,
         null::text
  from public.store_receipts
  where received_at >= p_window_start
    and received_at < p_window_end

  union all
  select 'display_movements',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'moved_at',
         format('moved_at >= %L and moved_at < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('display_movements'),
         min(moved_at)::date,
         max(moved_at)::date,
         null::text
  from public.display_movements
  where moved_at >= p_window_start
    and moved_at < p_window_end

  union all
  select 'end_of_day_counts',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'business_date',
         format('business_date >= %L and business_date < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('end_of_day_counts'),
         min(business_date),
         max(business_date),
         null::text
  from public.end_of_day_counts
  where business_date >= p_window_start
    and business_date < p_window_end

  union all
  select 'end_of_day_count_items',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'end_of_day_counts.business_date',
         format('parent end_of_day_counts.business_date >= %L and < %L', p_window_start, p_window_end),
         count(ei.*)::bigint,
         encode(digest(coalesce(string_agg(ei.id::text, ',' order by ei.id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('end_of_day_count_items'),
         min(ec.business_date),
         max(ec.business_date),
         'Date window comes from parent end_of_day_counts.'::text
  from public.end_of_day_count_items ei
  join public.end_of_day_counts ec on ec.id = ei.count_id
  where ec.business_date >= p_window_start
    and ec.business_date < p_window_end

  union all
  select 'store_deep_freezer_counts',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'business_date',
         format('business_date >= %L and business_date < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('store_deep_freezer_counts'),
         min(business_date),
         max(business_date),
         null::text
  from public.store_deep_freezer_counts
  where business_date >= p_window_start
    and business_date < p_window_end

  union all
  select 'store_deep_freezer_count_items',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'store_deep_freezer_counts.business_date',
         format('parent store_deep_freezer_counts.business_date >= %L and < %L', p_window_start, p_window_end),
         count(fi.*)::bigint,
         encode(digest(coalesce(string_agg(fi.id::text, ',' order by fi.id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('store_deep_freezer_count_items'),
         min(fc.business_date),
         max(fc.business_date),
         'Date window comes from parent store_deep_freezer_counts.'::text
  from public.store_deep_freezer_count_items fi
  join public.store_deep_freezer_counts fc on fc.id = fi.count_id
  where fc.business_date >= p_window_start
    and fc.business_date < p_window_end

  union all
  select 'inventory_adjustments',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'adjusted_at',
         format('adjusted_at >= %L and adjusted_at < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('inventory_adjustments'),
         min(adjusted_at)::date,
         max(adjusted_at)::date,
         null::text
  from public.inventory_adjustments
  where adjusted_at >= p_window_start
    and adjusted_at < p_window_end

  union all
  select 'attendance_entries',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'work_date',
         format('work_date >= %L and work_date < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('attendance_entries'),
         min(work_date),
         max(work_date),
         null::text
  from public.attendance_entries
  where work_date >= p_window_start
    and work_date < p_window_end

  union all
  select 'attendance_adjustments',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'adjusted_at',
         format('adjusted_at >= %L and adjusted_at < %L', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('attendance_adjustments'),
         min(adjusted_at)::date,
         max(adjusted_at)::date,
         null::text
  from public.attendance_adjustments
  where adjusted_at >= p_window_start
    and adjusted_at < p_window_end

  union all
  select 'urgent_requirements',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'created_at',
         format('created_at >= %L and created_at < %L and status in (fulfilled, cancelled)', p_window_start, p_window_end),
         count(*)::bigint,
         encode(digest(coalesce(string_agg(id::text, ',' order by id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('urgent_requirements'),
         min(created_at)::date,
         max(created_at)::date,
         'Only fulfilled or cancelled requirements are archive candidates.'::text
  from public.urgent_requirements
  where created_at >= p_window_start
    and created_at < p_window_end
    and status in ('fulfilled', 'cancelled')

  union all
  select 'urgent_requirement_events',
         'database_table',
         'Supabase recent-window + Drive archive',
         p_window_start,
         p_window_end,
         'urgent_requirements.created_at',
         format('parent urgent_requirements.created_at >= %L and < %L and parent status in (fulfilled, cancelled)', p_window_start, p_window_end),
         count(re.*)::bigint,
         encode(digest(coalesce(string_agg(re.id::text, ',' order by re.id::text), ''), 'sha256'), 'hex'),
         public.archive_table_schema_hash('urgent_requirement_events'),
         min(r.created_at)::date,
         max(r.created_at)::date,
         'Date window and close status come from parent urgent_requirements.'::text
  from public.urgent_requirement_events re
  join public.urgent_requirements r on r.id = re.urgent_requirement_id
  where r.created_at >= p_window_start
    and r.created_at < p_window_end
    and r.status in ('fulfilled', 'cancelled');
end;
$$;

alter table public.archive_manifests enable row level security;
alter table public.archive_files enable row level security;

drop policy if exists "archive manifests readable by admin" on public.archive_manifests;
create policy "archive manifests readable by admin"
on public.archive_manifests for select to authenticated
using (public.is_admin());

drop policy if exists "archive manifests managed by admin" on public.archive_manifests;
create policy "archive manifests managed by admin"
on public.archive_manifests for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "archive files readable by admin" on public.archive_files;
create policy "archive files readable by admin"
on public.archive_files for select to authenticated
using (public.is_admin());

drop policy if exists "archive files managed by admin" on public.archive_files;
create policy "archive files managed by admin"
on public.archive_files for all to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke execute on function public.archive_table_schema_hash(text) from public, anon;
revoke execute on function public.build_archive_manifest_candidates(date, date) from public, anon;

grant execute on function public.archive_table_schema_hash(text) to authenticated, service_role;
grant execute on function public.build_archive_manifest_candidates(date, date) to authenticated, service_role;
