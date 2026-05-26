alter table public.store_deep_freezer_counts
  add column if not exists count_type text not null default 'eod';

alter table public.store_deep_freezer_counts
  drop constraint if exists store_deep_freezer_count_type_valid;

alter table public.store_deep_freezer_counts
  add constraint store_deep_freezer_count_type_valid
  check (count_type in ('eod', 'morning'));

alter table public.store_deep_freezer_count_items
  add column if not exists expected_weight_kg numeric(8,3);

alter table public.store_deep_freezer_count_items
  add column if not exists variance_kg numeric(8,3);

alter table public.store_deep_freezer_counts
  drop constraint if exists store_deep_freezer_counts_location_id_business_date_key;

create unique index if not exists store_deep_freezer_counts_location_date_type_uidx
on public.store_deep_freezer_counts(location_id, business_date, count_type);

drop index if exists public.store_deep_freezer_counts_location_date_idx;

create index if not exists store_deep_freezer_counts_location_date_idx
on public.store_deep_freezer_counts(location_id, count_type, business_date desc);
