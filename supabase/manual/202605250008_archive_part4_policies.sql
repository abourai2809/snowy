alter table public.archive_manifests enable row level security;
alter table public.archive_files enable row level security;

drop policy if exists "archive manifests readable by admin" on public.archive_manifests;
create policy "archive manifests readable by admin"
on public.archive_manifests for select to authenticated
using (public.is_admin());

drop policy if exists "archive manifests managed by admin" on public.archive_manifests;
create policy "archive manifests managed by admin"
on public.archive_manifests for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "archive files readable by admin" on public.archive_files;
create policy "archive files readable by admin"
on public.archive_files for select to authenticated
using (public.is_admin());

drop policy if exists "archive files managed by admin" on public.archive_files;
create policy "archive files managed by admin"
on public.archive_files for all to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke execute on function public.archive_table_schema_hash(text) from public, anon;
revoke execute on function public.build_archive_manifest_candidates(date, date) from public, anon;

grant execute on function public.archive_table_schema_hash(text) to authenticated, service_role;
grant execute on function public.build_archive_manifest_candidates(date, date) to authenticated, service_role;
