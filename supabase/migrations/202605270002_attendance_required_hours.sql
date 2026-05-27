alter table public.users
  add column if not exists required_hours_per_day numeric(4,2);

update public.users
set required_hours_per_day = 8
where required_hours_per_day is null;

alter table public.users
  alter column required_hours_per_day set default 8,
  alter column required_hours_per_day set not null;

alter table public.users
  drop constraint if exists users_required_hours_per_day_range;

alter table public.users
  add constraint users_required_hours_per_day_range
  check (required_hours_per_day > 0 and required_hours_per_day <= 24);
