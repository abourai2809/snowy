---
title: Harden Supabase RLS helper functions
date: 2026-05-23
category: security-issues
module: Supabase database baseline
problem_type: security_issue
component: database
symptoms:
  - "Supabase Studio showed 30 issues need attention after the MVP database migration"
  - "Security advisor listed public.current_app_role(), public.current_app_user_id(), public.has_app_role(), and public.is_admin()"
  - "After revoking broad execution grants, Studio still showed 4 security issues for the same helper functions"
root_cause: config_error
resolution_type: migration
severity: medium
tags: [supabase, rls, security-definer, search-path, function-grants, database]
---

# Harden Supabase RLS Helper Functions

## Problem

The MVP Supabase migration added helper functions used by Row Level Security policies, but Supabase Studio flagged them as security issues before the schema was pushed to the remote project. The functions were central to role checks, so ignoring the warnings would have carried insecure database defaults into the production schema.

## Symptoms

- Supabase Studio showed `30 issues need attention` after the local migration.
- The Security tab listed the four RLS helper functions: `public.current_app_user_id()`, `public.current_app_role()`, `public.has_app_role(...)`, and `public.is_admin()`.
- Revoking public execution reduced the count but still left `26 issues need attention`, with 4 remaining security findings.
- `npx supabase db lint --local --schema public --fail-on none` reported no schema errors, so the issue came from the stricter Studio database advisor, not migration syntax.

## What Didn't Work

- Treating the warning as local-only noise was not enough. The first four findings were real function-grant exposure.
- Fixing only function grants was incomplete. It removed `PUBLIC` and `anon` execution, but Studio still flagged the four `SECURITY DEFINER` functions because they used `search_path = public`.
- Relying only on `supabase db lint` would have missed this. The lint command checks schema errors, while Studio advisors also flag security posture issues.

## Solution

The migration now hardens the four helper functions in two ways:

1. `SECURITY DEFINER` functions use an empty search path and fully qualified object names.
2. Function execution is explicitly revoked from `PUBLIC` and `anon`, then granted only to app roles that need it.

Relevant migration pattern:

```sql
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.active = true
  limit 1
$$;

revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
```

The same pattern applies to:

- `public.current_app_user_id()`
- `public.current_app_role()`
- `public.has_app_role(public.app_role[])`
- `public.is_admin()`

Validation commands used locally:

```bash
npx supabase db reset
npx supabase db lint --local --schema public --fail-on none
```

Direct checks confirmed:

- The helper functions now have `search_path=""`.
- Function grants are limited to `authenticated`, `postgres`, and `service_role`.
- Seed data still loads.
- RLS smoke tests still pass: store staff cannot create catalog data, Admin can.

## Why This Works

Postgres grants function execution to `PUBLIC` by default unless revoked. For RLS helper functions, that default is too broad because `anon` users should not be able to call role-inspection helpers directly.

`SECURITY DEFINER` functions also run with the privileges of the function owner. If such a function has a mutable search path, an attacker can sometimes influence object resolution. Using `set search_path = ''` and fully qualifying all referenced objects makes the function resolve only the intended schema objects.

The combination of restricted execution grants and an empty search path satisfies the security posture needed for helper functions that participate in authorization.

## Prevention

- For every new `SECURITY DEFINER` function, set `search_path = ''` and fully qualify referenced tables, functions, and types.
- Revoke default function execution from `PUBLIC` and `anon` when helper functions are meant only for authenticated app users.
- Check Supabase Studio database advisors before pushing migrations to a linked remote project.
- Do not rely on `supabase db lint` alone for security posture; it can pass while Studio still reports security advisor findings.
- Add direct verification for grants and search path after local migration resets:

```sql
select p.proname, p.prosecdef, array_to_string(p.proconfig, ',')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_app_user_id', 'current_app_role', 'has_app_role', 'is_admin');

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('current_app_user_id', 'current_app_role', 'has_app_role', 'is_admin')
order by routine_name, grantee;
```

## Related Issues

- GitHub issue #4: MVP 1 Supabase intake and database baseline.
- Commits: `692d523 fix(db): restrict helper function execution`, `c9a91bb fix(db): harden helper function search paths`.
