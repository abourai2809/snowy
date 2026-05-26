drop table if exists pg_temp.staff_users_to_delete;

create temp table staff_users_to_delete on commit drop as
select id, auth_user_id
from public.users
where role in ('store_staff', 'store_manager', 'lab_staff', 'lab_manager');

delete from auth.users
where id in (
  select auth_user_id
  from staff_users_to_delete
  where auth_user_id is not null
);

update public.gelato_batches
set produced_by = null
where produced_by in (select id from staff_users_to_delete);

update public.pan_events
set recorded_by = null
where recorded_by in (select id from staff_users_to_delete);

update public.dispatches
set dispatched_by = null
where dispatched_by in (select id from staff_users_to_delete);

update public.store_receipts
set received_by = null
where received_by in (select id from staff_users_to_delete);

update public.display_movements
set moved_by = null
where moved_by in (select id from staff_users_to_delete);

update public.end_of_day_counts
set submitted_by = case
      when submitted_by in (select id from staff_users_to_delete) then null
      else submitted_by
    end,
    corrected_by = case
      when corrected_by in (select id from staff_users_to_delete) then null
      else corrected_by
    end;

update public.store_deep_freezer_counts
set submitted_by = case
      when submitted_by in (select id from staff_users_to_delete) then null
      else submitted_by
    end,
    corrected_by = case
      when corrected_by in (select id from staff_users_to_delete) then null
      else corrected_by
    end;

update public.inventory_adjustments
set adjusted_by = null
where adjusted_by in (select id from staff_users_to_delete);

update public.attendance_adjustments
set adjusted_by = null
where adjusted_by in (select id from staff_users_to_delete);

update public.urgent_requirements
set created_by = case
      when created_by in (select id from staff_users_to_delete) then null
      else created_by
    end,
    acknowledged_by = case
      when acknowledged_by in (select id from staff_users_to_delete) then null
      else acknowledged_by
    end,
    fulfilled_by = case
      when fulfilled_by in (select id from staff_users_to_delete) then null
      else fulfilled_by
    end;

update public.urgent_requirement_events
set actor_id = null
where actor_id in (select id from staff_users_to_delete);

update public.queuebuster_jobs
set requested_by = case
      when requested_by in (select id from staff_users_to_delete) then null
      else requested_by
    end,
    confirmed_by = case
      when confirmed_by in (select id from staff_users_to_delete) then null
      else confirmed_by
    end;

update public.archive_manifests
set created_by = null
where created_by in (select id from staff_users_to_delete);

delete from public.holiday_policies
where user_id in (select id from staff_users_to_delete);

delete from public.users
where id in (select id from staff_users_to_delete);
