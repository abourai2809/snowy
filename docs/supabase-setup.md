# Supabase Setup

This project uses Supabase for MVP persistence: catalog, staff, attendance, gelato batches, pans, dispatches, store counts, and inventory counts.

Linked project:

- Name: `snowy-owl-ops`
- Project ref: `mbjiqmrsjjxputwveymi`

## Secrets And Local Config

Do not commit real credentials.

- Commit `.env.example` only.
- Put local values in `.env.local`.
- Supabase CLI login tokens are stored by the CLI outside this repo.
- Production secrets belong in Supabase project settings/secrets.
- QueueBuster/POS credentials are not part of MVP 1.

Required local values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_PROJECT_REF=...
SUPABASE_DB_URL=...
```

The anon key is safe to use in a frontend only when Row Level Security is correct. Keep it out of source code anyway so environments can change without editing code.

`SUPABASE_SERVICE_ROLE_KEY` is required only for trusted backend contexts such as Vercel API routes and QueueBuster/background workers. It must not be added to frontend code, committed to Git, or exposed with a `VITE_` prefix.

## Install Or Run The Supabase CLI

This machine did not have the Supabase CLI installed when MVP 1 started.

Options:

```bash
brew install supabase/tap/supabase
```

or use it through npm:

```bash
npx supabase --version
```

## First Remote Inspection

Before pushing this schema to the existing Supabase project, inspect the remote project.

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db pull
```

Review the pulled migration before applying local changes. If the remote project already contains tables, reconcile names and policies instead of blindly replacing them.

The `snowy-owl-ops` remote already had prototype tables from the original single-file app, including `flavours`, `stores`, `users`, `lab_gelato`, `store_gelato`, `dispatches`, `attendance`, and `qb_sales_staging`. The MVP migration preserves those by renaming them to `legacy_*` before creating the canonical MVP tables.

## Local Development

Start Supabase locally:

```bash
supabase start
```

Reset the local database from migrations and seed data:

```bash
supabase db reset
```

The local API URL and anon key printed by `supabase start` go in `.env.local`.

## Applying To Remote

After remote inspection and local validation:

```bash
supabase db push
```

Do not push until the remote schema has been compared with `supabase db pull`.

## Schema Test

The database schema test is in `tests/db/schema.test.ts`. It expects `SUPABASE_DB_URL` or `DATABASE_URL` to point at the database being tested.

The app scaffold issue will add the test runner dependencies. Until then, use the SQL migration and seed reset as the primary verification.

Current local validation:

- `supabase start` successfully applied `202605210001_operations_mvp.sql`.
- `supabase db reset` successfully reapplied the migration and `supabase/seed.sql`.
- Local schema has 33 public application tables and 15 public enum types.
- RLS is enabled on all 33 application tables.
- Seed counts are 5 roles, 4 locations, 30 flavours, 5 catalog categories, and 17 catalog items.
- RLS smoke checks passed: store staff cannot create catalog data, Admin can.

Attendance location changes are tracked in `attendance_location_segments`; an active shift can move between stores without creating a second attendance entry or interrupting hours worked.
