create extension if not exists pgcrypto with schema extensions;

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
