create unique index if not exists pans_one_active_display_assignment_per_store_flavour_idx
on public.pans(current_location_id, flavour_id)
where active
  and current_location_id is not null
  and pan_role = 'display'
  and status in ('display', 'returned');

comment on index public.pans_one_active_display_assignment_per_store_flavour_idx is
  'Ensures one active display-assigned pan per store and flavour. Returned display pans stay assigned until checkout.';
