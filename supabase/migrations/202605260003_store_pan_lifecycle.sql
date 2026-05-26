create or replace view public.store_empty_pan_counts
with (security_invoker = true) as
select
  locations.id as location_id,
  locations.name as location_name,
  count(pans.id)::integer as empty_pan_count
from public.locations
left join public.pans
  on pans.current_location_id = locations.id
  and pans.status = 'closed'
  and pans.active = false
  and coalesce(pans.current_weight_kg, 0) = 0
where locations.type = 'store'
group by locations.id, locations.name;

comment on view public.store_empty_pan_counts is
  'Backend-calculated empty gelato pan count by store. Empty pans are closed, inactive pan records with zero current weight.';
