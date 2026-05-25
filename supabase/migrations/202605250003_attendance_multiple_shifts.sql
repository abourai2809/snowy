alter table public.attendance_entries
drop constraint if exists attendance_entries_user_id_work_date_key;

create unique index if not exists attendance_entries_one_open_shift_idx
on public.attendance_entries(user_id, work_date)
where check_out_at is null;
