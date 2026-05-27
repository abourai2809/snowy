create table if not exists public.attendance_location_segments (
  id uuid primary key default gen_random_uuid(),
  attendance_entry_id uuid not null references public.attendance_entries(id) on delete cascade,
  user_id text not null references public.users(id),
  location_id text not null references public.locations(id),
  work_date date not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_location_segments_time_order
    check (check_out_at is null or check_out_at >= check_in_at)
);

insert into public.attendance_location_segments (
  attendance_entry_id,
  user_id,
  location_id,
  work_date,
  check_in_at,
  check_out_at
)
select
  id,
  user_id,
  location_id,
  work_date,
  check_in_at,
  check_out_at
from public.attendance_entries
where location_id is not null
on conflict do nothing;

create index if not exists attendance_location_segments_entry_idx
on public.attendance_location_segments(attendance_entry_id);

create index if not exists attendance_location_segments_user_date_idx
on public.attendance_location_segments(user_id, work_date, check_in_at);

create unique index if not exists attendance_location_segments_one_open_idx
on public.attendance_location_segments(user_id, work_date)
where check_out_at is null;

alter table public.attendance_location_segments enable row level security;

create policy "attendance location segments read self or manager"
on public.attendance_location_segments for select to authenticated
using (
  public.is_admin()
  or user_id = public.current_app_user_id()
  or public.has_app_role(array['store_manager','lab_manager']::public.app_role[])
);

create policy "attendance location segments insert self or admin"
on public.attendance_location_segments for insert to authenticated
with check (public.is_admin() or user_id = public.current_app_user_id());

create policy "attendance location segments update self or manager"
on public.attendance_location_segments for update to authenticated
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

grant select, insert, update on public.attendance_location_segments to authenticated;
grant all on public.attendance_location_segments to service_role;
