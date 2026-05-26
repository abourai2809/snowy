create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

alter table public.app_settings enable row level security;

insert into public.app_settings (key, value, description)
values (
  'location_check_in_required',
  'true'::jsonb,
  'When true, attendance check-in and check-out require browser geolocation verification.'
)
on conflict (key) do nothing;

drop policy if exists "app settings readable by authenticated users" on public.app_settings;
create policy "app settings readable by authenticated users"
on public.app_settings for select to authenticated
using (true);

drop policy if exists "app settings managed by admin" on public.app_settings;
create policy "app settings managed by admin"
on public.app_settings for all to authenticated
using (public.is_admin())
with check (public.is_admin());
