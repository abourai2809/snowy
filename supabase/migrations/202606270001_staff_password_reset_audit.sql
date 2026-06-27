alter table public.users
  add column if not exists password_reset_requested_by uuid references public.users(id),
  add column if not exists password_reset_requested_at timestamptz;

create index if not exists users_password_reset_requested_at_idx
on public.users(password_reset_requested_at);
