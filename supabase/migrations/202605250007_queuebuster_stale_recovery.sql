create or replace function public.recover_stale_queuebuster_jobs(
  max_age_minutes integer default 30,
  max_attempts integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_count integer := 0;
  recovered record;
begin
  if max_age_minutes < 1 then
    raise exception 'max_age_minutes must be positive.';
  end if;

  if max_attempts < 1 then
    raise exception 'max_attempts must be positive.';
  end if;

  for recovered in
    update public.queuebuster_jobs
    set status = case
          when attempts >= max_attempts then 'failed'::public.queuebuster_job_status
          else 'pending'::public.queuebuster_job_status
        end,
        last_error = case
          when attempts >= max_attempts then 'Worker timed out and max attempts were reached.'
          else last_error
        end,
        claimed_by = null,
        claimed_at = null,
        run_started_at = null,
        run_completed_at = case
          when attempts >= max_attempts then now()
          else null
        end,
        updated_at = now()
    where status = 'running'::public.queuebuster_job_status
      and claimed_at < now() - make_interval(mins => max_age_minutes)
    returning id, status
  loop
    recovered_count := recovered_count + 1;

    insert into public.queuebuster_job_events (
      queuebuster_job_id,
      event_type,
      status,
      message,
      safe_payload
    )
    values (
      recovered.id,
      'stale_recovered',
      recovered.status,
      case
        when recovered.status = 'failed'::public.queuebuster_job_status then 'Stale worker job failed after max attempts.'
        else 'Stale worker job returned to pending.'
      end,
      jsonb_build_object('maxAgeMinutes', max_age_minutes, 'maxAttempts', max_attempts)
    );
  end loop;

  return recovered_count;
end;
$$;

revoke execute on function public.recover_stale_queuebuster_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.recover_stale_queuebuster_jobs(integer, integer) to service_role;
