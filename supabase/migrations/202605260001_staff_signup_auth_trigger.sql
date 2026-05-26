alter table public.users
add column if not exists signup_status text not null default 'approved',
add column if not exists signup_requested_at timestamptz,
add column if not exists approved_at timestamptz,
add column if not exists rejected_at timestamptz,
add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'locations'
      and policyname = 'locations readable for signup'
  ) then
    execute $policy$
      create policy "locations readable for signup"
      on public.locations for select to anon
      using (active = true)
    $policy$;
  end if;
end $$;

create or replace function public.create_staff_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_phone text;
  staff_name text;
  requested_role public.app_role;
  requested_location_id text;
begin
  staff_phone := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g');

  if staff_phone !~ '^[0-9]{10}$' then
    return new;
  end if;

  staff_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');

  requested_role := case new.raw_user_meta_data ->> 'role'
    when 'store_manager' then 'store_manager'::public.app_role
    when 'lab_manager' then 'lab_manager'::public.app_role
    when 'lab_staff' then 'lab_staff'::public.app_role
    else 'store_staff'::public.app_role
  end;

  select id into requested_location_id
  from public.locations
  where id = nullif(new.raw_user_meta_data ->> 'defaultLocationId', '')
    and active = true
  limit 1;

  insert into public.users (
    auth_user_id,
    name,
    phone,
    role,
    default_location_id,
    salary_amount,
    salary_type,
    allowed_holidays_per_month,
    active,
    signup_status,
    signup_requested_at
  )
  values (
    new.id,
    coalesce(staff_name, staff_phone),
    staff_phone,
    requested_role,
    requested_location_id,
    null,
    'daily'::public.salary_type,
    0,
    false,
    'pending',
    now()
  )
  on conflict (phone) do update
  set auth_user_id = coalesce(users.auth_user_id, excluded.auth_user_id),
      signup_requested_at = coalesce(users.signup_requested_at, excluded.signup_requested_at),
      updated_at = now()
  where users.role <> 'admin'::public.app_role;

  return new;
end;
$$;

drop trigger if exists create_staff_profile_from_auth_user on auth.users;

create trigger create_staff_profile_from_auth_user
after insert on auth.users
for each row execute function public.create_staff_profile_from_auth_user();

with auth_staff as (
  select
    auth_users.id as auth_user_id,
    regexp_replace(coalesce(auth_users.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g') as phone,
    nullif(btrim(coalesce(auth_users.raw_user_meta_data ->> 'name', '')), '') as name,
    case auth_users.raw_user_meta_data ->> 'role'
      when 'store_manager' then 'store_manager'::public.app_role
      when 'lab_manager' then 'lab_manager'::public.app_role
      when 'lab_staff' then 'lab_staff'::public.app_role
      else 'store_staff'::public.app_role
    end as role,
    locations.id as default_location_id,
    auth_users.created_at
  from auth.users auth_users
  left join public.locations locations
    on locations.id = nullif(auth_users.raw_user_meta_data ->> 'defaultLocationId', '')
   and locations.active = true
)
insert into public.users (
  auth_user_id,
  name,
  phone,
  role,
  default_location_id,
  salary_amount,
  salary_type,
  allowed_holidays_per_month,
  active,
  signup_status,
  signup_requested_at
)
select
  auth_user_id,
  coalesce(name, phone),
  phone,
  role,
  default_location_id,
  null,
  'daily'::public.salary_type,
  0,
  false,
  'pending',
  coalesce(created_at, now())
from auth_staff
where phone ~ '^[0-9]{10}$'
  and not exists (
    select 1
    from public.users existing_users
    where existing_users.auth_user_id = auth_staff.auth_user_id
  )
on conflict (phone) do update
set auth_user_id = coalesce(users.auth_user_id, excluded.auth_user_id),
    signup_requested_at = coalesce(users.signup_requested_at, excluded.signup_requested_at),
    updated_at = now()
where users.role <> 'admin'::public.app_role;
