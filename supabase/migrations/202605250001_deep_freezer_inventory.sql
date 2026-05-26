create table if not exists public.store_deep_freezer_counts (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  business_date date not null,
  count_type text not null default 'eod',
  status public.count_status not null default 'submitted',
  submitted_by uuid references public.users(id),
  submitted_at timestamptz not null default now(),
  corrected_by uuid references public.users(id),
  corrected_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, business_date, count_type),
  constraint store_deep_freezer_count_type_valid check (count_type in ('eod', 'morning'))
);

create table if not exists public.store_deep_freezer_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.store_deep_freezer_counts(id) on delete cascade,
  flavour_id uuid not null references public.flavours(id),
  weight_kg numeric(8,3) not null default 0,
  unit text not null default 'kg',
  expected_weight_kg numeric(8,3),
  variance_kg numeric(8,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (count_id, flavour_id),
  constraint store_deep_freezer_weight_nonnegative check (weight_kg >= 0)
);

create table if not exists public.store_flavour_targets (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  flavour_id uuid not null references public.flavours(id),
  target_weight_kg numeric(8,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, flavour_id),
  constraint store_flavour_target_nonnegative check (target_weight_kg >= 0)
);

create index if not exists store_deep_freezer_counts_location_date_idx
on public.store_deep_freezer_counts(location_id, count_type, business_date desc);

create index if not exists store_deep_freezer_count_items_flavour_idx
on public.store_deep_freezer_count_items(flavour_id);

create index if not exists store_flavour_targets_location_idx
on public.store_flavour_targets(location_id);

alter table public.store_deep_freezer_counts enable row level security;
alter table public.store_deep_freezer_count_items enable row level security;
alter table public.store_flavour_targets enable row level security;

drop policy if exists "deep freezer counts readable by staff" on public.store_deep_freezer_counts;
create policy "deep freezer counts readable by staff"
on public.store_deep_freezer_counts for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "deep freezer counts writable by store roles and admin" on public.store_deep_freezer_counts;
create policy "deep freezer counts writable by store roles and admin"
on public.store_deep_freezer_counts for all to authenticated
using (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

drop policy if exists "deep freezer items readable by staff" on public.store_deep_freezer_count_items;
create policy "deep freezer items readable by staff"
on public.store_deep_freezer_count_items for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "deep freezer items writable by store roles and admin" on public.store_deep_freezer_count_items;
create policy "deep freezer items writable by store roles and admin"
on public.store_deep_freezer_count_items for all to authenticated
using (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

drop policy if exists "store flavour targets readable by staff" on public.store_flavour_targets;
create policy "store flavour targets readable by staff"
on public.store_flavour_targets for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "store flavour targets managed by admin" on public.store_flavour_targets;
create policy "store flavour targets managed by admin"
on public.store_flavour_targets for all to authenticated
using (public.is_admin()) with check (public.is_admin());
