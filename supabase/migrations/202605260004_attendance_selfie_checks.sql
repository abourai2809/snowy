insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-selfies',
  'attendance-selfies',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.attendance_selfie_checks (
  id uuid primary key default gen_random_uuid(),
  attendance_entry_id uuid not null references public.attendance_entries(id) on delete cascade,
  selfie_kind text not null default 'check_in',
  selfie_path text not null,
  status text not null default 'queued',
  overall_status text,
  apron_status text,
  headwear_status text,
  glove_thumbs_up_status text,
  confidence numeric(4,3),
  model text,
  notes text,
  raw_response jsonb not null default '{}'::jsonb,
  error_message text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_selfie_kind_known check (selfie_kind in ('check_in', 'check_out')),
  constraint attendance_selfie_status_known check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint attendance_selfie_overall_known check (overall_status is null or overall_status in ('pass', 'needs_review')),
  constraint attendance_selfie_apron_known check (apron_status is null or apron_status in ('pass', 'fail', 'unclear')),
  constraint attendance_selfie_headwear_known check (headwear_status is null or headwear_status in ('pass', 'fail', 'unclear')),
  constraint attendance_selfie_glove_known check (glove_thumbs_up_status is null or glove_thumbs_up_status in ('pass', 'fail', 'unclear')),
  constraint attendance_selfie_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists attendance_selfie_checks_entry_idx
on public.attendance_selfie_checks(attendance_entry_id);

create index if not exists attendance_selfie_checks_queue_idx
on public.attendance_selfie_checks(status, created_at);

alter table public.attendance_selfie_checks enable row level security;

drop policy if exists "attendance selfie checks readable by owner or manager" on public.attendance_selfie_checks;
create policy "attendance selfie checks readable by owner or manager"
on public.attendance_selfie_checks for select to authenticated
using (
  exists (
    select 1
    from public.attendance_entries e
    where e.id = attendance_entry_id
      and (
        public.is_admin()
        or e.user_id = public.current_app_user_id()
        or public.has_app_role(array['store_manager','lab_manager']::public.app_role[])
      )
  )
);

drop policy if exists "attendance selfie checks insert own" on public.attendance_selfie_checks;
create policy "attendance selfie checks insert own"
on public.attendance_selfie_checks for insert to authenticated
with check (
  exists (
    select 1
    from public.attendance_entries e
    where e.id = attendance_entry_id
      and (public.is_admin() or e.user_id = public.current_app_user_id())
  )
);

drop policy if exists "attendance selfie checks manager update" on public.attendance_selfie_checks;
create policy "attendance selfie checks manager update"
on public.attendance_selfie_checks for update to authenticated
using (public.is_admin() or public.has_app_role(array['store_manager','lab_manager']::public.app_role[]))
with check (public.is_admin() or public.has_app_role(array['store_manager','lab_manager']::public.app_role[]));

drop policy if exists "attendance selfies upload own folder" on storage.objects;
create policy "attendance selfies upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attendance-selfies'
  and (storage.foldername(name))[1] = public.current_app_user_id()::text
);

drop policy if exists "attendance selfies read own or manager" on storage.objects;
create policy "attendance selfies read own or manager"
on storage.objects for select to authenticated
using (
  bucket_id = 'attendance-selfies'
  and (
    (storage.foldername(name))[1] = public.current_app_user_id()::text
    or public.is_admin()
    or public.has_app_role(array['store_manager','lab_manager']::public.app_role[])
  )
);
