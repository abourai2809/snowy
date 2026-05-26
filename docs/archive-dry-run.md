# Archive Dry-Run Manifests

Issue reference: #21

This is the first backend-only slice of the retention workflow from [data-retention.md](architecture/data-retention.md). It creates a dry-run manifest for old Supabase operational records. It does not upload files to Google Drive and does not delete Supabase rows.

## Prerequisites

Run the archive manifest migration first:

```bash
supabase/migrations/202605250008_archive_manifests.sql
```

Set backend-only environment variables on the machine running the script:

```bash
SUPABASE_URL=https://mbjiqmrsjjxputwveymi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ARCHIVE_ENVIRONMENT=production
```

The service-role key must stay in local environment variables, VM secrets, or backend secret storage. Do not put it in frontend code, `.env.example`, Git, Vercel public variables, or Google Drive.

## Run A Dry Run

Default target is the previous closed calendar month:

```bash
npm run archive:dry-run
```

To target a specific month:

```bash
ARCHIVE_MONTH=2026-04 npm run archive:dry-run
```

To target an explicit half-open window:

```bash
ARCHIVE_WINDOW_START=2026-04-01 ARCHIVE_WINDOW_END=2026-05-01 npm run archive:dry-run
```

The script writes a JSON manifest under `archive-manifests/`, which is ignored by Git. To print the manifest instead:

```bash
ARCHIVE_LOG_ONLY=1 npm run archive:dry-run
```

To also record the dry-run manifest and source rows in Supabase index tables:

```bash
ARCHIVE_RECORD_MANIFEST=1 npm run archive:dry-run
```

## What The Dry Run Includes

The manifest includes:

- Run ID, environment, code version, creation time, and archive window.
- Candidate operational tables from the retention matrix.
- Query predicate for each table/date window.
- Row count, primary key hash, min/max business date, and schema hash.
- Google Drive folder path that future live mode will use.
- Deletion status fixed to `not_started` and `allowed: false`.

Current QueueBuster/POS raw CSV and parsed staging exports are listed as deferred sources because the POS ingestion tables are not implemented yet.

## Future Live Google Drive Mode

Live mode should be a separate worker issue. It should:

- Export database rows as gzip-compressed JSON Lines.
- Upload files and immutable manifest JSON to Google Drive using backend-only Drive credentials.
- Store Drive folder/file IDs, byte sizes, and SHA-256 checksums in `archive_files`.
- Mark a manifest `verified` only after Drive readback checks row counts, primary key hash, byte size, and checksum.
- Permit deletion/compaction only after a verified manifest and a separate admin-approved delete run.

Google Drive credentials must stay off the frontend and out of Git. For development, use local environment variables. For production, use VM or backend secret storage.
