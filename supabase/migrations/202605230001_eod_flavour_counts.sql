alter table public.end_of_day_count_items
add column if not exists flavour_id uuid references public.flavours(id);

alter table public.end_of_day_count_items
drop constraint if exists eod_item_has_subject;

alter table public.end_of_day_count_items
add constraint eod_item_has_subject check (
  pan_uuid is not null
  or catalog_item_id is not null
  or flavour_id is not null
);
