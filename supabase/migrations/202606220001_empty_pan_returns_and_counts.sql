create table if not exists public.empty_pan_returns (
  id uuid primary key default gen_random_uuid(),
  source_location_id text not null references public.locations(id),
  destination_location_id text not null references public.locations(id) default 'lab',
  quantity integer not null,
  status text not null default 'in_transit',
  created_by uuid references public.users(id),
  sent_at timestamptz not null default now(),
  received_by uuid references public.users(id),
  received_at timestamptz,
  notes text,
  resolution_notes text,
  constraint empty_pan_returns_quantity_positive check (quantity > 0),
  constraint empty_pan_returns_status_known check (status in ('in_transit', 'accepted', 'disputed', 'cancelled'))
);

create table if not exists public.physical_empty_pan_counts (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references public.locations(id),
  business_date date not null,
  count_type text not null default 'eod',
  physical_count integer not null,
  app_calculated_count integer not null,
  variance integer not null,
  status text not null,
  counted_by uuid references public.users(id),
  counted_at timestamptz not null default now(),
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  notes text,
  constraint physical_empty_pan_counts_nonnegative check (
    physical_count >= 0
    and app_calculated_count >= 0
  ),
  constraint physical_empty_pan_counts_type_known check (count_type in ('eod', 'morning')),
  constraint physical_empty_pan_counts_status_known check (status in ('matched', 'flagged', 'resolved'))
);

create index if not exists empty_pan_returns_source_status_idx
on public.empty_pan_returns(source_location_id, status, sent_at desc);

create index if not exists physical_empty_pan_counts_location_status_idx
on public.physical_empty_pan_counts(location_id, status, counted_at desc);

alter table public.empty_pan_returns enable row level security;
alter table public.physical_empty_pan_counts enable row level security;

drop policy if exists "empty pan returns readable by staff" on public.empty_pan_returns;
create policy "empty pan returns readable by staff"
on public.empty_pan_returns for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "empty pan returns created by store roles and admin" on public.empty_pan_returns;
create policy "empty pan returns created by store roles and admin"
on public.empty_pan_returns for insert to authenticated
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

drop policy if exists "empty pan returns updated by lab and admin" on public.empty_pan_returns;
create policy "empty pan returns updated by lab and admin"
on public.empty_pan_returns for update to authenticated
using (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]))
with check (public.has_app_role(array['admin','lab_manager','lab_staff']::public.app_role[]));

drop policy if exists "physical empty pan counts readable by staff" on public.physical_empty_pan_counts;
create policy "physical empty pan counts readable by staff"
on public.physical_empty_pan_counts for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "physical empty pan counts created by store roles and admin" on public.physical_empty_pan_counts;
create policy "physical empty pan counts created by store roles and admin"
on public.physical_empty_pan_counts for insert to authenticated
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

drop policy if exists "physical empty pan counts resolved by managers" on public.physical_empty_pan_counts;
create policy "physical empty pan counts resolved by managers"
on public.physical_empty_pan_counts for update to authenticated
using (public.has_app_role(array['admin','store_manager']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager']::public.app_role[]));

create or replace view public.store_empty_pan_counts
with (security_invoker = true) as
with closed_pans as (
  select
    locations.id as location_id,
    locations.name as location_name,
    count(pans.id)::integer as closed_empty_pan_count
  from public.locations
  left join public.pans
    on pans.current_location_id = locations.id
    and pans.status = 'closed'
    and pans.active = false
    and coalesce(pans.current_weight_kg, 0) = 0
  where locations.type = 'store'
  group by locations.id, locations.name
),
active_returns as (
  select
    source_location_id as location_id,
    coalesce(sum(quantity), 0)::integer as returned_empty_pan_count
  from public.empty_pan_returns
  where status in ('in_transit', 'accepted', 'disputed')
  group by source_location_id
)
select
  closed_pans.location_id,
  closed_pans.location_name,
  greatest(
    closed_pans.closed_empty_pan_count - coalesce(active_returns.returned_empty_pan_count, 0),
    0
  )::integer as empty_pan_count
from closed_pans
left join active_returns on active_returns.location_id = closed_pans.location_id;

comment on table public.empty_pan_returns is
  'Quantity-based reverse dispatches for empty gelato pans moving from stores back to lab.';

comment on table public.physical_empty_pan_counts is
  'Store-entered physical empty-pan counts compared against app-calculated empty pan counts.';
