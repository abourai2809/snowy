create table if not exists public.urgent_requirements (
  id uuid primary key default gen_random_uuid(),
  source_location_id text not null references public.locations(id),
  requirement_type text not null check (requirement_type in ('gelato','store_supply','packaging','maintenance','other')),
  related_flavour_id uuid references public.flavours(id),
  related_catalog_item_id uuid references public.catalog_items(id),
  quantity numeric(10,2),
  unit text,
  priority text not null default 'urgent' check (priority in ('urgent','high','normal')),
  message text not null,
  status text not null default 'submitted' check (status in ('submitted','acknowledged','in_progress','fulfilled','cancelled')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  acknowledged_by uuid references public.users(id),
  acknowledged_at timestamptz,
  fulfilled_by uuid references public.users(id),
  fulfilled_at timestamptz
);

create table if not exists public.urgent_requirement_events (
  id uuid primary key default gen_random_uuid(),
  urgent_requirement_id uuid not null references public.urgent_requirements(id) on delete cascade,
  event_type text not null,
  status text not null,
  message text,
  actor_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists urgent_requirements_status_idx
on public.urgent_requirements(status, created_at desc);

create index if not exists urgent_requirements_source_location_idx
on public.urgent_requirements(source_location_id);

create index if not exists urgent_requirement_events_requirement_idx
on public.urgent_requirement_events(urgent_requirement_id, created_at);

alter table public.urgent_requirements enable row level security;
alter table public.urgent_requirement_events enable row level security;

drop policy if exists "urgent requirements readable by staff" on public.urgent_requirements;
create policy "urgent requirements readable by staff"
on public.urgent_requirements for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "urgent requirements created by store roles and admin" on public.urgent_requirements;
create policy "urgent requirements created by store roles and admin"
on public.urgent_requirements for insert to authenticated
with check (public.has_app_role(array['admin','store_manager','store_staff']::public.app_role[]));

drop policy if exists "urgent requirements updated by managers" on public.urgent_requirements;
create policy "urgent requirements updated by managers"
on public.urgent_requirements for update to authenticated
using (public.has_app_role(array['admin','store_manager','lab_manager']::public.app_role[]))
with check (public.has_app_role(array['admin','store_manager','lab_manager']::public.app_role[]));

drop policy if exists "urgent requirement events readable by staff" on public.urgent_requirement_events;
create policy "urgent requirement events readable by staff"
on public.urgent_requirement_events for select to authenticated
using (public.current_app_role() is not null);

drop policy if exists "urgent requirement events writable by staff" on public.urgent_requirement_events;
create policy "urgent requirement events writable by staff"
on public.urgent_requirement_events for insert to authenticated
with check (public.current_app_role() is not null);
