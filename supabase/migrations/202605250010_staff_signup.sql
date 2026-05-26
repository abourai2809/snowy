do $$
begin
  alter table public.users
    add column if not exists signup_status text not null default 'approved',
    add column if not exists signup_requested_at timestamptz,
    add column if not exists approved_at timestamptz,
    add column if not exists rejected_at timestamptz;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_signup_status_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_signup_status_check
      check (signup_status in ('approved', 'pending', 'rejected'));
  end if;
end $$;

update public.users
set signup_status = 'approved'
where signup_status is null;

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

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users can request staff signup'
  ) then
    execute $policy$
      create policy "users can request staff signup"
      on public.users for insert to authenticated
      with check (
        auth_user_id = auth.uid()
        and active = false
        and signup_status = 'pending'
        and role <> 'admin'::public.app_role
      )
    $policy$;
  end if;
end $$;
