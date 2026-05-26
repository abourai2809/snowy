do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'archive_manifests_run_id_unique'
      and conrelid = 'public.archive_manifests'::regclass
  ) and to_regclass('public.archive_manifests_run_id_unique') is null then
    alter table public.archive_manifests
    add constraint archive_manifests_run_id_unique unique (run_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'archive_manifests_window_valid'
      and conrelid = 'public.archive_manifests'::regclass
  ) then
    alter table public.archive_manifests
    add constraint archive_manifests_window_valid check (window_end > window_start);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'archive_manifests_source_count_nonnegative'
      and conrelid = 'public.archive_manifests'::regclass
  ) then
    alter table public.archive_manifests
    add constraint archive_manifests_source_count_nonnegative check (candidate_source_count >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'archive_manifests_row_count_nonnegative'
      and conrelid = 'public.archive_manifests'::regclass
  ) then
    alter table public.archive_manifests
    add constraint archive_manifests_row_count_nonnegative check (candidate_row_count >= 0);
  end if;
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
    extensions.digest(
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
