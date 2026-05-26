create extension if not exists pgcrypto;

-- The linked Supabase project already contains prototype tables from the
-- single-file app. Preserve them before creating the canonical MVP schema.
do $$
declare
  table_name text;
  view_name text;
begin
  foreach table_name in array array[
    'attendance',
    'dispatches',
    'event_consumed',
    'event_gelato',
    'events',
    'flavours',
    'lab_gelato',
    'lab_raw_materials',
    'lab_returns',
    'lab_supplies',
    'qb_sales_staging',
    'requirements',
    'store_consumed',
    'store_gelato',
    'store_received',
    'store_supplies',
    'store_transfers',
    'stores',
    'users',
    'weekly_offs'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null
       and to_regclass(format('public.%I', 'legacy_' || table_name)) is null then
      execute format('alter table public.%I rename to %I', table_name, 'legacy_' || table_name);
    end if;
  end loop;

  foreach view_name in array array[
    'v_low_stock_alerts',
    'v_monthly_attendance',
    'v_pending_dispatch_by_store'
  ]
  loop
    if to_regclass(format('public.%I', view_name)) is not null
       and to_regclass(format('public.%I', 'legacy_' || view_name)) is null then
      execute format('alter view public.%I rename to %I', view_name, 'legacy_' || view_name);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'dispatch_status'
  )
  and not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'legacy_dispatch_status'
  ) then
    alter type public.dispatch_status rename to legacy_dispatch_status;
  end if;

  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'pan_role'
  )
  and not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'legacy_pan_role'
  ) then
    alter type public.pan_role rename to legacy_pan_role;
  end if;
end $$;

create type public.app_role as enum (
  'admin',
  'store_manager',
  'lab_manager',
  'store_staff',
  'lab_staff'
);

create type public.location_type as enum ('lab', 'store');
create type public.catalog_scope as enum ('lab', 'store', 'both');
create type public.catalog_item_kind as enum ('raw_material', 'supply', 'packaging', 'product', 'other');
create type public.salary_type as enum ('monthly', 'daily');
create type public.pan_role as enum ('store', 'backup', 'display', 'event');
create type public.pan_status as enum ('available', 'in_transit', 'received', 'display', 'reserved', 'returned', 'closed');
create type public.dispatch_status as enum ('draft', 'pending', 'accepted', 'partially_accepted', 'rejected', 'cancelled');
create type public.receipt_status as enum ('accepted', 'rejected');
create type public.fill_state as enum ('full', 'partial');
create type public.count_status as enum ('draft', 'submitted', 'corrected');
create type public.attendance_status as enum ('active', 'checked_out', 'corrected', 'void', 'approved', 'pending', 'rejected');
create type public.queuebuster_job_type as enum (
  'audit_flavour',
  'add_flavour',
  'fix_flavour',
  'catalog_products_check',
  'download_pos_csv',
  'reconcile_pos',
  'attendance_alert_check'
);
create type public.queuebuster_job_status as enum (
  'pending',
  'running',
  'needs_confirmation',
  'succeeded',
  'failed',
  'cancelled'
);
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
create type public.archive_manifest_mode as enum ('dry_run', 'live');

create table public.roles (
  id public.app_role primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table public.locations (
  id text primary key,
  name text not null,
  type public.location_type not null,
  capacity integer,
  latitude numeric(10,7),
  longitude numeric(10,7),
  attendance_radius_m integer not null default 150,
  attendance_accuracy_limit_m integer not null default 100,
  pos_alias text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_attendance_radius_positive check (attendance_radius_m > 0),
  constraint locations_attendance_accuracy_positive check (attendance_accuracy_limit_m > 0),
  constraint locations_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text unique,
  role public.app_role not null references public.roles(id),
  default_location_id text references public.locations(id),
  salary_amount numeric(12,2),
  salary_type public.salary_type,
  allowed_holidays_per_month integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_phone_digits check (phone is null or phone ~ '^[0-9]{10}$')
);

create table public.holiday_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  allowed_holidays_per_month integer not null default 0,
  bonus_days_balance numeric(6,2) not null default 0,
  effective_from date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.flavours (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text not null unique,
  seasonal boolean not null default false,
  sorbet boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flavours_short_code_format check (short_code ~ '^[A-Z0-9]{3,6}$')
);

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique,
  name text not null,
  item_kind public.catalog_item_kind not null,
  scope public.catalog_scope not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  category_id uuid not null references public.catalog_categories(id),
  name text not null,
  item_kind public.catalog_item_kind not null,
  scope public.catalog_scope not null,
  unit text not null,
  default_min_qty numeric(12,3) not null default 0,
  track_inventory boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create table public.raw_materials (
  catalog_item_id uuid primary key references public.catalog_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.supplies (
  catalog_item_id uuid primary key references public.catalog_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  name text not null,
  catalog_item_id uuid references public.catalog_items(id),
  flavour_id uuid references public.flavours(id),
  scope public.catalog_scope not null default 'store',
  track_inventory boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_components (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id),
  quantity numeric(12,3) not null,
  unit text not null,
  created_at timestamptz not null default now(),
  unique (product_id, catalog_item_id)
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  catalog_item_id uuid not null references public.catalog_items(id),
  quantity numeric(12,3) not null default 0,
  min_qty numeric(12,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (location_id, catalog_item_id)
);

create table public.gelato_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  flavour_id uuid not null references public.flavours(id),
  production_date date not null,
  produced_by uuid references public.users(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.pans (
  id uuid primary key default gen_random_uuid(),
  pan_id text not null unique,
  batch_id uuid references public.gelato_batches(id),
  flavour_id uuid not null references public.flavours(id),
  current_location_id text references public.locations(id),
  pan_role public.pan_role not null default 'backup',
  status public.pan_status not null default 'available',
  full_weight_kg numeric(8,3),
  current_weight_kg numeric(8,3),
  produced_at timestamptz not null default now(),
  closed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pans_weight_nonnegative check (
    (full_weight_kg is null or full_weight_kg >= 0)
    and (current_weight_kg is null or current_weight_kg >= 0)
  )
);

create table public.pan_events (
  id uuid primary key default gen_random_uuid(),
  pan_uuid uuid not null references public.pans(id) on delete cascade,
  event_type text not null,
  from_location_id text references public.locations(id),
  to_location_id text references public.locations(id),
  from_role public.pan_role,
  to_role public.pan_role,
  weight_kg numeric(8,3),
  recorded_by uuid references public.users(id),
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_code text not null unique,
  from_location_id text not null references public.locations(id),
  to_location_id text not null references public.locations(id),
  status public.dispatch_status not null default 'pending',
  dispatched_by uuid references public.users(id),
  dispatched_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table public.dispatch_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.dispatches(id) on delete cascade,
  pan_uuid uuid not null references public.pans(id),
  planned_weight_kg numeric(8,3),
  accepted boolean,
  accepted_weight_kg numeric(8,3),
  notes text,
  unique (dispatch_id, pan_uuid)
);

create table public.store_receipts (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.dispatches(id),
  location_id text not null references public.locations(id),
  status public.receipt_status not null,
  received_by uuid references public.users(id),
  received_at timestamptz not null default now(),
  notes text
);

create table public.display_movements (
  id uuid primary key default gen_random_uuid(),
  pan_uuid uuid not null references public.pans(id),
  store_location_id text not null references public.locations(id),
  fill_state public.fill_state not null,
  weight_kg numeric(8,3),
  moved_by uuid references public.users(id),
  moved_at timestamptz not null default now(),
  constraint partial_display_requires_weight check (
    fill_state = 'full' or weight_kg is not null
  )
);

create table public.end_of_day_counts (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  business_date date not null,
  status public.count_status not null default 'submitted',
  submitted_by uuid references public.users(id),
  submitted_at timestamptz not null default now(),
  corrected_by uuid references public.users(id),
  corrected_at timestamptz,
  notes text,
  unique (location_id, business_date)
);

create table public.end_of_day_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.end_of_day_counts(id) on delete cascade,
  pan_uuid uuid references public.pans(id),
  catalog_item_id uuid references public.catalog_items(id),
  quantity numeric(12,3),
  weight_kg numeric(8,3),
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  constraint eod_item_has_subject check (
    pan_uuid is not null or catalog_item_id is not null
  )
);

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  pan_uuid uuid references public.pans(id),
  catalog_item_id uuid references public.catalog_items(id),
  adjustment_type text not null,
  quantity_delta numeric(12,3),
  weight_delta_kg numeric(8,3),
  adjusted_by uuid references public.users(id),
  adjusted_at timestamptz not null default now(),
  notes text,
  constraint inventory_adjustment_has_subject check (
    pan_uuid is not null or catalog_item_id is not null
  )
);

create table public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  location_id text references public.locations(id),
  work_date date not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  hours numeric(6,2),
  status public.attendance_status not null default 'active',
  check_in_latitude numeric(10,7),
  check_in_longitude numeric(10,7),
  check_in_accuracy_m numeric(8,2),
  check_in_distance_m numeric(8,2),
  check_in_validation_location_id text references public.locations(id),
  check_in_location_status text,
  check_in_location_error text,
  check_out_latitude numeric(10,7),
  check_out_longitude numeric(10,7),
  check_out_accuracy_m numeric(8,2),
  check_out_distance_m numeric(8,2),
  check_out_validation_location_id text references public.locations(id),
  check_out_location_status text,
  check_out_location_error text,
  selfie_in_url text,
  selfie_out_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_check_in_location_status_known check (
    check_in_location_status is null
    or check_in_location_status in (
      'verified',
      'denied',
      'unavailable',
      'timeout',
      'unsupported',
      'poor_accuracy',
      'outside_radius',
      'not_configured',
      'unknown_error'
    )
  ),
  constraint attendance_check_out_location_status_known check (
    check_out_location_status is null
    or check_out_location_status in (
      'verified',
      'denied',
      'unavailable',
      'timeout',
      'unsupported',
      'poor_accuracy',
      'outside_radius',
      'not_configured',
      'unknown_error'
    )
  )
);

create table public.attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_entry_id uuid references public.attendance_entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  adjusted_by uuid references public.users(id),
  bonus_days_delta numeric(6,2) not null default 0,
  holiday_days_delta numeric(6,2) not null default 0,
  notes text,
  adjusted_at timestamptz not null default now()
);

create table public.urgent_requirements (
  id uuid primary key default gen_random_uuid(),
  source_location_id text not null references public.locations(id),
  requirement_type text not null check (requirement_type in ('gelato','store_supply','packaging','maintenance','other')),
  related_flavour_id uuid references public.flavours(id),
  related_catalog_item_id uuid references public.catalog_items(id),
  quantity numeric(10,2),
  unit text,
  priority text not null default 'urgent' check (priority in ('urgent','high','normal')),
  message text not null,
  status text not null default 'submitted' check (status in ('submitted','acknowledged','in_progress','fulfilled','cancelled')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  acknowledged_by uuid references public.users(id),
  acknowledged_at timestamptz,
  fulfilled_by uuid references public.users(id),
  fulfilled_at timestamptz
);

create table public.urgent_requirement_events (
  id uuid primary key default gen_random_uuid(),
  urgent_requirement_id uuid not null references public.urgent_requirements(id) on delete cascade,
  event_type text not null,
  status text not null,
  message text,
  actor_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.queuebuster_jobs (
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
  updated_at timestamptz not null default now(),
  constraint queuebuster_jobs_attempts_nonnegative check (attempts >= 0),
  constraint queuebuster_jobs_mutations_have_audit check (
    job_type not in ('add_flavour','fix_flavour')
    or audit_job_id is not null
  ),
  constraint queuebuster_jobs_mutations_confirmed_before_run check (
    job_type not in ('add_flavour','fix_flavour')
    or status in ('needs_confirmation','cancelled','failed')
    or (confirmed_by is not null and confirmed_at is not null)
  )
);

create table public.queuebuster_job_events (
  id uuid primary key default gen_random_uuid(),
  queuebuster_job_id uuid not null references public.queuebuster_jobs(id) on delete cascade,
  event_type text not null,
  status public.queuebuster_job_status not null,
  message text,
  safe_payload jsonb,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.archive_manifests (
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

create table public.archive_files (
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

create index users_auth_user_id_idx on public.users(auth_user_id);
create index users_role_idx on public.users(role);
create index catalog_items_scope_idx on public.catalog_items(scope);
create index pans_pan_id_idx on public.pans(pan_id);
create index pans_location_status_idx on public.pans(current_location_id, status);
create index dispatches_to_location_status_idx on public.dispatches(to_location_id, status);
create index attendance_entries_work_date_idx on public.attendance_entries(work_date);
create unique index attendance_entries_one_open_shift_idx on public.attendance_entries(user_id, work_date) where check_out_at is null;
create index end_of_day_counts_location_date_idx on public.end_of_day_counts(location_id, business_date);
create index urgent_requirements_status_idx on public.urgent_requirements(status, created_at desc);
create index urgent_requirements_source_location_idx on public.urgent_requirements(source_location_id);
create index urgent_requirement_events_requirement_idx on public.urgent_requirement_events(urgent_requirement_id, created_at);
create index queuebuster_jobs_status_created_idx on public.queuebuster_jobs(status, created_at);
create index queuebuster_jobs_type_created_idx on public.queuebuster_jobs(job_type, created_at desc);
create index queuebuster_job_events_job_idx on public.queuebuster_job_events(queuebuster_job_id, created_at);
create index archive_manifests_window_idx on public.archive_manifests(environment, window_start, window_end);
create index archive_files_manifest_idx on public.archive_files(manifest_id);
create index archive_files_source_window_idx on public.archive_files(source_table, window_start, window_end);

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.active = true
  limit 1
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.active = true
  limit 1
$$;

create or replace function public.has_app_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = any(required_roles), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() = 'admin'::public.app_role
$$;

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

create or replace function public.recover_stale_queuebuster_jobs(
  max_age_minutes integer default 30,
  max_attempts integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_count integer := 0;
  recovered record;
begin
  if max_age_minutes < 1 then
    raise exception 'max_age_minutes must be positive.';
  end if;

  if max_attempts < 1 then
    raise exception 'max_attempts must be positive.';
  end if;

  for recovered in
    update public.queuebuster_jobs
    set status = case
          when attempts >= max_attempts then 'failed'::public.queuebuster_job_status
          else 'pending'::public.queuebuster_job_status
        end,
        last_error = case
          when attempts >= max_attempts then 'Worker timed out and max attempts were reached.'
          else last_error
        end,
        claimed_by = null,
        claimed_at = null,
        run_started_at = null,
        run_completed_at = case
          when attempts >= max_attempts then now()
          else null
        end,
        updated_at = now()
    where status = 'running'::public.queuebuster_job_status
      and claimed_at < now() - make_interval(mins => max_age_minutes)
    returning id, status
  loop
    recovered_count := recovered_count + 1;

    insert into public.queuebuster_job_events (
      queuebuster_job_id,
      event_type,
      status,
      message,
      safe_payload
    )
    values (
      recovered.id,
      'stale_recovered',
      recovered.status,
      case
        when recovered.status = 'failed'::public.queuebuster_job_status then 'Stale worker job failed after max attempts.'
        else 'Stale worker job returned to pending.'
      end,
      jsonb_build_object('maxAgeMinutes', max_age_minutes, 'maxAttempts', max_attempts)
    );
  end loop;

  return recovered_count;
end;
$$;

alter table public.roles enable row level security;
alter table public.locations enable row level security;
alter table public.users enable row level security;
alter table public.holiday_policies enable row level security;
alter table public.flavours enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_items enable row level security;
alter table public.raw_materials enable row level security;
alter table public.supplies enable row level security;
alter table public.products enable row level security;
alter table public.product_components enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.gelato_batches enable row level security;
alter table public.pans enable row level security;
alter table public.pan_events enable row level security;
alter table public.dispatches enable row level security;
alter table public.dispatch_items enable row level security;
alter table public.store_receipts enable row level security;
alter table public.display_movements enable row level security;
alter table public.end_of_day_counts enable row level security;
alter table public.end_of_day_count_items enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.attendance_adjustments enable row level security;
alter table public.urgent_requirements enable row level security;
alter table public.urgent_requirement_events enable row level security;
alter table public.queuebuster_jobs enable row level security;
alter table public.queuebuster_job_events enable row level security;
alter table public.archive_manifests enable row level security;
alter table public.archive_files enable row level security;

create policy "roles readable by authenticated users"
on public.roles for select to authenticated using (true);

create policy "locations readable by authenticated users"
on public.locations for select to authenticated using (active = true or public.is_admin());

create policy "locations managed by admin"
on public.locations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users read self or admin"
on public.users for select to authenticated
using (auth_user_id = auth.uid() or public.is_admin());

create policy "users managed by admin"
on public.users for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "holiday policies read self or admin"
on public.holiday_policies for select to authenticated
using (
  public.is_admin()
  or user_id = public.current_app_user_id()
);

create policy "holiday policies managed by admin"
on public.holiday_policies for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "flavours readable by authenticated users"
on public.flavours for select to authenticated
using (active = true or public.is_admin());

create policy "flavours managed by admin"
on public.flavours for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "catalog categories readable by authenticated users"
on public.catalog_categories for select to authenticated
using (active = true or public.is_admin());

create policy "catalog categories managed by admin"
on public.catalog_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "catalog items readable by authenticated users"
on public.catalog_items for select to authenticated
using (active = true or public.is_admin());

create policy "catalog items managed by admin"
on public.catalog_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "raw materials readable by authenticated users"
on public.raw_materials for select to authenticated using (true);

create policy "raw materials managed by admin"
on public.raw_materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "supplies readable by authenticated users"
on public.supplies for select to authenticated using (true);

create policy "supplies managed by admin"
on public.supplies for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products readable by authenticated users"
on public.products for select to authenticated
using (active = true or public.is_admin());

create policy "products managed by admin"
on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product components readable by authenticated users"
on public.product_components for select to authenticated using (true);

create policy "product components managed by admin"
on public.product_components for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "inventory balances readable by staff"
on public.inventory_balances for select to authenticated
using (public.current_app_role() is not null);

create policy "inventory balances writable by operators"
on public.inventory_balances for all to authenticated
using (public.current_app_role() is not null)
with check (public.current_app_role() is not null);

create policy "gelato batches readable by staff"
on public.gelato_batches for select to authenticated
using (public.current_app_role() is not null);

create policy "gelato batches writable by lab and admin"
on public.gelato_batches for all to authenticated
using (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]));

create policy "pans readable by staff"
on public.pans for select to authenticated
using (public.current_app_role() is not null);

create policy "pans writable by operators"
on public.pans for all to authenticated
using (public.current_app_role() is not null)
with check (public.current_app_role() is not null);

create policy "pan events readable by staff"
on public.pan_events for select to authenticated
using (public.current_app_role() is not null);

create policy "pan events writable by operators"
on public.pan_events for insert to authenticated
with check (public.current_app_role() is not null);

create policy "dispatches readable by staff"
on public.dispatches for select to authenticated
using (public.current_app_role() is not null);

create policy "dispatches writable by lab and admin"
on public.dispatches for all to authenticated
using (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]));

create policy "dispatch items readable by staff"
on public.dispatch_items for select to authenticated
using (public.current_app_role() is not null);

create policy "dispatch items writable by lab and admin"
on public.dispatch_items for all to authenticated
using (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]));

create policy "store receipts readable by staff"
on public.store_receipts for select to authenticated
using (public.current_app_role() is not null);

create policy "store receipts writable by store roles and admin"
on public.store_receipts for all to authenticated
using (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

create policy "display movements readable by staff"
on public.display_movements for select to authenticated
using (public.current_app_role() is not null);

create policy "display movements writable by store roles and admin"
on public.display_movements for all to authenticated
using (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

create policy "eod counts readable by staff"
on public.end_of_day_counts for select to authenticated
using (public.current_app_role() is not null);

create policy "eod counts writable by store roles and admin"
on public.end_of_day_counts for all to authenticated
using (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

create policy "eod count items readable by staff"
on public.end_of_day_count_items for select to authenticated
using (public.current_app_role() is not null);

create policy "eod count items writable by store roles and admin"
on public.end_of_day_count_items for all to authenticated
using (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

create policy "inventory adjustments readable by staff"
on public.inventory_adjustments for select to authenticated
using (public.current_app_role() is not null);

create policy "inventory adjustments writable by operators"
on public.inventory_adjustments for all to authenticated
using (public.current_app_role() is not null)
with check (public.current_app_role() is not null);

create policy "attendance read self or manager"
on public.attendance_entries for select to authenticated
using (
  public.is_admin()
  or user_id = public.current_app_user_id()
  or public.has_app_role(array['store_manager','lab_manager']::public.app_role[])
);

create policy "attendance insert self or admin"
on public.attendance_entries for insert to authenticated
with check (public.is_admin() or user_id = public.current_app_user_id());

create policy "attendance update self active checkout or manager"
on public.attendance_entries for update to authenticated
using (
  public.is_admin()
  or user_id = public.current_app_user_id()
  or public.has_app_role(array['store_manager','lab_manager']::public.app_role[])
)
with check (
  public.is_admin()
  or user_id = public.current_app_user_id()
  or public.has_app_role(array['store_manager','lab_manager']::public.app_role[])
);

create policy "attendance adjustments read self or admin"
on public.attendance_adjustments for select to authenticated
using (
  public.is_admin()
  or user_id = public.current_app_user_id()
);

create policy "attendance adjustments managed by admin"
on public.attendance_adjustments for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "urgent requirements readable by staff"
on public.urgent_requirements for select to authenticated
using (public.current_app_role() is not null);

create policy "urgent requirements created by store roles and admin"
on public.urgent_requirements for insert to authenticated
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

create policy "urgent requirements updated by managers"
on public.urgent_requirements for update to authenticated
using (public.has_app_role(array['admin','store_manager','lab_manager']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','lab_manager']::public.app_role[]));

create policy "urgent requirement events readable by staff"
on public.urgent_requirement_events for select to authenticated
using (public.current_app_role() is not null);

create policy "urgent requirement events writable by staff"
on public.urgent_requirement_events for insert to authenticated
with check (public.current_app_role() is not null);

create policy "queuebuster jobs readable by admin"
on public.queuebuster_jobs for select to authenticated
using (public.is_admin());

create policy "queuebuster jobs created by admin"
on public.queuebuster_jobs for insert to authenticated
with check (public.is_admin());

create policy "queuebuster jobs updated by admin"
on public.queuebuster_jobs for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "queuebuster job events readable by admin"
on public.queuebuster_job_events for select to authenticated
using (public.is_admin());

create policy "queuebuster job events created by admin"
on public.queuebuster_job_events for insert to authenticated
with check (public.is_admin());

create policy "archive manifests readable by admin"
on public.archive_manifests for select to authenticated
using (public.is_admin());

create policy "archive manifests managed by admin"
on public.archive_manifests for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "archive files readable by admin"
on public.archive_files for select to authenticated
using (public.is_admin());

create policy "archive files managed by admin"
on public.archive_files for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

revoke execute on function public.current_app_user_id() from public, anon;
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.has_app_role(public.app_role[]) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.claim_next_queuebuster_job(text) from public, anon, authenticated;
revoke execute on function public.recover_stale_queuebuster_jobs(integer, integer) from public, anon, authenticated;

grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.has_app_role(public.app_role[]) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.claim_next_queuebuster_job(text) to service_role;
grant execute on function public.recover_stale_queuebuster_jobs(integer, integer) to service_role;
