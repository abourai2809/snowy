alter table public.locations
add column if not exists latitude numeric(10,7),
add column if not exists longitude numeric(10,7),
add column if not exists attendance_radius_m integer not null default 150,
add column if not exists attendance_accuracy_limit_m integer not null default 100,
add column if not exists pos_alias text;

do $$
begin
  alter table public.locations
  add constraint locations_attendance_radius_positive
  check (attendance_radius_m > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.locations
  add constraint locations_attendance_accuracy_positive
  check (attendance_accuracy_limit_m > 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.locations
  add constraint locations_coordinates_pair
  check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  );
exception
  when duplicate_object then null;
end $$;

update public.locations
set latitude = case id
    when 'lab' then 30.2932355
    when 'rajpur' then 30.3423856
    when 'malsi' then 30.3949920
    when 'mussoorie' then 30.4552185
    else latitude
  end,
  longitude = case id
    when 'lab' then 78.0603935
    when 'rajpur' then 78.0611274
    when 'malsi' then 78.0748199
    when 'mussoorie' then 78.0811381
    else longitude
  end,
  attendance_radius_m = 150,
  attendance_accuracy_limit_m = 100,
  pos_alias = case id
    when 'malsi' then 'Snowy Owl Cottage'
    else pos_alias
  end,
  updated_at = now()
where id in ('lab', 'rajpur', 'malsi', 'mussoorie');

alter table public.attendance_entries
add column if not exists check_in_latitude numeric(10,7),
add column if not exists check_in_longitude numeric(10,7),
add column if not exists check_in_accuracy_m numeric(8,2),
add column if not exists check_in_distance_m numeric(8,2),
add column if not exists check_in_validation_location_id text references public.locations(id),
add column if not exists check_in_location_status text,
add column if not exists check_in_location_error text,
add column if not exists check_out_latitude numeric(10,7),
add column if not exists check_out_longitude numeric(10,7),
add column if not exists check_out_accuracy_m numeric(8,2),
add column if not exists check_out_distance_m numeric(8,2),
add column if not exists check_out_validation_location_id text references public.locations(id),
add column if not exists check_out_location_status text,
add column if not exists check_out_location_error text;

do $$
begin
  alter table public.attendance_entries
  add constraint attendance_check_in_location_status_known
  check (
    check_in_location_status is null
    or check_in_location_status in (
      'verified',
      'denied',
      'unavailable',
      'timeout',
      'unsupported',
      'poor_accuracy',
      'outside_radius',
      'not_configured',
      'unknown_error'
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.attendance_entries
  add constraint attendance_check_out_location_status_known
  check (
    check_out_location_status is null
    or check_out_location_status in (
      'verified',
      'denied',
      'unavailable',
      'timeout',
      'unsupported',
      'poor_accuracy',
      'outside_radius',
      'not_configured',
      'unknown_error'
    )
  );
exception
  when duplicate_object then null;
end $$;
