alter table public.attendance_selfie_checks
  add column if not exists archive_provider text,
  add column if not exists archive_path text,
  add column if not exists archive_file_id text,
  add column if not exists archived_at timestamptz,
  add column if not exists storage_deleted_at timestamptz,
  add column if not exists archive_error text;

create index if not exists attendance_selfie_checks_archival_idx
on public.attendance_selfie_checks(created_at, archived_at, storage_deleted_at)
where selfie_path is not null;

alter table public.attendance_selfie_checks
  drop constraint if exists attendance_selfie_archive_provider_known;

alter table public.attendance_selfie_checks
  add constraint attendance_selfie_archive_provider_known
  check (archive_provider is null or archive_provider in ('google_drive'));
