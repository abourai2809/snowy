create or replace function public.build_archive_manifest_candidates(
  p_window_start date,
  p_window_end date
)
returns table (
  source_table text,
  source_kind text,
  retention_class text,
  window_start date,
  window_end date,
  date_column text,
  predicate text,
  row_count bigint,
  primary_key_hash text,
  schema_hash text,
  min_business_date date,
  max_business_date date,
  notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row record;
  aggregate_row record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Admin access is required to build archive manifests.';
  end if;

  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'Archive window must have a start date before the end date.';
  end if;

  for source_row in
    select *
    from (
      values
        ('pan_events', 'public.pan_events', 'id', 'recorded_at', 'recorded_at', '', null::text),
        ('dispatches', 'public.dispatches', 'id', 'dispatched_at', 'dispatched_at', '', null::text),
        ('dispatch_items', 'public.dispatch_items di join public.dispatches d on d.id = di.dispatch_id', 'di.id', 'd.dispatched_at', 'dispatches.dispatched_at', '', 'Date window comes from parent dispatches.'::text),
        ('store_receipts', 'public.store_receipts', 'id', 'received_at', 'received_at', '', null::text),
        ('display_movements', 'public.display_movements', 'id', 'moved_at', 'moved_at', '', null::text),
        ('end_of_day_counts', 'public.end_of_day_counts', 'id', 'business_date', 'business_date', '', null::text),
        ('end_of_day_count_items', 'public.end_of_day_count_items ei join public.end_of_day_counts ec on ec.id = ei.count_id', 'ei.id', 'ec.business_date', 'end_of_day_counts.business_date', '', 'Date window comes from parent end_of_day_counts.'::text),
        ('store_deep_freezer_counts', 'public.store_deep_freezer_counts', 'id', 'business_date', 'business_date', '', null::text),
        ('store_deep_freezer_count_items', 'public.store_deep_freezer_count_items fi join public.store_deep_freezer_counts fc on fc.id = fi.count_id', 'fi.id', 'fc.business_date', 'store_deep_freezer_counts.business_date', '', 'Date window comes from parent store_deep_freezer_counts.'::text),
        ('inventory_adjustments', 'public.inventory_adjustments', 'id', 'adjusted_at', 'adjusted_at', '', null::text),
        ('attendance_entries', 'public.attendance_entries', 'id', 'work_date', 'work_date', '', null::text),
        ('attendance_adjustments', 'public.attendance_adjustments', 'id', 'adjusted_at', 'adjusted_at', '', null::text),
        ('urgent_requirements', 'public.urgent_requirements', 'id', 'created_at', 'created_at', 'and status in (''fulfilled'', ''cancelled'')', 'Only fulfilled or cancelled requirements are archive candidates.'::text),
        ('urgent_requirement_events', 'public.urgent_requirement_events re join public.urgent_requirements r on r.id = re.urgent_requirement_id', 're.id', 'r.created_at', 'urgent_requirements.created_at', 'and r.status in (''fulfilled'', ''cancelled'')', 'Date window and close status come from parent urgent_requirements.'::text)
    ) as sources(table_name, relation_sql, id_expr, date_expr, date_label, extra_where, source_notes)
  loop
    execute format(
      'select count(*)::bigint as row_count,
              encode(extensions.digest(coalesce(string_agg(%1$s::text, '','' order by %1$s::text), ''''), ''sha256''), ''hex'') as primary_key_hash,
              min(%2$s)::date as min_business_date,
              max(%2$s)::date as max_business_date
       from %3$s
       where %2$s >= $1 and %2$s < $2 %4$s',
      source_row.id_expr,
      source_row.date_expr,
      source_row.relation_sql,
      source_row.extra_where
    )
    using p_window_start, p_window_end
    into aggregate_row;

    source_table := source_row.table_name;
    source_kind := 'database_table';
    retention_class := 'Supabase recent-window + Drive archive';
    window_start := p_window_start;
    window_end := p_window_end;
    date_column := source_row.date_label;
    predicate := format('%s >= %L and %s < %L %s',
      source_row.date_label,
      p_window_start,
      source_row.date_label,
      p_window_end,
      source_row.extra_where
    );
    row_count := coalesce(aggregate_row.row_count, 0);
    primary_key_hash := aggregate_row.primary_key_hash;
    schema_hash := public.archive_table_schema_hash(source_row.table_name);
    min_business_date := aggregate_row.min_business_date;
    max_business_date := aggregate_row.max_business_date;
    notes := source_row.source_notes;
    return next;
  end loop;
end;
$$;
