# Supabase and Google Drive Data Retention

Issue reference: #22

This document defines how Snowy Owl Operations should retain data as the app grows. Supabase remains the live operational database. Google Drive is cold storage for verified archive files; it is not a query database and must not be accessed from frontend code.

## Retention Classes

| Class | Meaning | Default policy |
| --- | --- | --- |
| Supabase forever | Keep rows queryable in Supabase indefinitely. Used for master data, configuration, current state, and archive indexes. | Never delete as part of archive jobs. Use admin UI corrections instead of removal. |
| Supabase recent-window + Drive archive | Keep rows queryable in Supabase for live workflows, reports, payroll, and corrections. Write an immutable archive copy to Google Drive, then compact/delete only after the hot window and manifest verification pass. | Archive closed calendar months after month-end close. Delete from Supabase only after 13 months unless a tighter table rule is listed. |
| Google Drive archive only | Keep source files or raw high-volume artifacts in Drive, with searchable summaries/manifests in Supabase. | Store raw files in Drive immediately after ingestion; keep Supabase summaries and manifest rows forever. |
| Never archive | Data that should not be written to Supabase archives or Drive archives. | Keep only in backend secret stores, local environment variables, or transient browser/session state. |

## Current Table Matrix

| Table | Retention class | Hot window | Archive contents | Supabase forever summary/index |
| --- | --- | --- | --- | --- |
| `roles` | Supabase forever | Indefinite | None | Full table remains. |
| `locations` | Supabase forever | Indefinite | None | Full table remains, including store/lab config, coordinates, radius, and POS alias. |
| `users` | Supabase forever | Indefinite | Optional annual staff export only, not deletion-driven | Full staff profile, role, auth mapping, active flag, and default location remain. |
| `holiday_policies` | Supabase forever | Indefinite | Optional annual staff export only | Full policy history remains because payroll/attendance depends on it. |
| `flavours` | Supabase forever | Indefinite | None | Full flavour catalog remains, including inactive flavours for historical references. |
| `catalog_categories` | Supabase forever | Indefinite | None | Full category catalog remains. |
| `catalog_items` | Supabase forever | Indefinite | None | Full item catalog remains, including inactive items for old counts. |
| `raw_materials` | Supabase forever | Indefinite | None | Full master-data mapping remains. |
| `supplies` | Supabase forever | Indefinite | None | Full master-data mapping remains. |
| `products` | Supabase forever | Indefinite | None | Full sellable/product catalog remains, including inactive products for old records. |
| `product_components` | Supabase forever | Indefinite | None | Full recipe/component mapping remains until a versioned recipe model replaces it. |
| `inventory_balances` | Supabase forever | Indefinite | Monthly balance snapshot optional | Current balance rows remain. Historical changes come from counts and adjustments. |
| `store_flavour_targets` | Supabase forever | Indefinite | None | Current target weights per store/flavour remain. |
| `gelato_batches` | Supabase forever | Indefinite | Monthly batch export optional | Batch identity remains for pan traceability and FIFO audit. |
| `pans` | Supabase forever | Indefinite | Monthly closed-pan export optional | Pan identity, current/closed status, flavour, batch, and last known location remain. |
| `pan_events` | Supabase recent-window + Drive archive | 13 months after `recorded_at` | Full event rows, metadata, actor, pan, location, role, and weight fields | Daily pan movement summary by store/lab, flavour, role transition, and event type. |
| `dispatches` | Supabase recent-window + Drive archive | 13 months after `dispatched_at` | Full dispatch header rows | Daily dispatch summary by source, destination, status, and pan count. |
| `dispatch_items` | Supabase recent-window + Drive archive | 13 months after parent dispatch | Full item rows with pan UUID, planned and accepted weights | Daily dispatch item totals by destination and flavour. |
| `store_receipts` | Supabase recent-window + Drive archive | 13 months after `received_at` | Full receipt rows | Daily receipt summary by store, status, and receiving user. |
| `display_movements` | Supabase recent-window + Drive archive | 13 months after `moved_at` | Full movement rows with pan, fill state, and weight | Daily display movement summary by store and flavour. |
| `end_of_day_counts` | Supabase recent-window + Drive archive | 13 months after `business_date` | Full count header rows, status, corrections, notes | Daily store count summary by location, date, status, submitter, and correction status. |
| `end_of_day_count_items` | Supabase recent-window + Drive archive | 13 months after parent count date | Full item rows for display pans, supply counts, quantities, weights, and notes | Daily totals by location, item/flavour, unit, and count type. |
| `store_deep_freezer_counts` | Supabase recent-window + Drive archive | 13 months after `business_date` | Full deep-freezer count header rows | Daily deep-freezer summary by store and correction status. |
| `store_deep_freezer_count_items` | Supabase recent-window + Drive archive | 13 months after parent count date | Full flavour weight rows | Daily deep-freezer weight by store and flavour. |
| `inventory_adjustments` | Supabase recent-window + Drive archive | 13 months after `adjusted_at` | Full adjustment rows with actor, subject, deltas, and notes | Daily adjustment totals by location, item/flavour, adjustment type, and actor. |
| `attendance_entries` | Supabase recent-window + Drive archive | 13 months after `work_date` | Full shift rows, check-in/out times, hours, status, location evidence, and error fields | Monthly payroll/attendance summary by user, location, work date, hours, and adjustment state. |
| `attendance_adjustments` | Supabase recent-window + Drive archive | 13 months after `adjusted_at` | Full adjustment rows with actor, deltas, and notes | Monthly staff adjustment summary by user and adjustment type. |
| `urgent_requirements` | Supabase recent-window + Drive archive | 13 months after `created_at` once status is `fulfilled` or `cancelled` | Full requirement rows and final status | Monthly requirement summary by store, type, priority, status, and fulfilment time. |
| `urgent_requirement_events` | Supabase recent-window + Drive archive | 13 months after parent requirement close | Full event timeline rows | Requirement lifecycle summary remains through the parent summary. |

## Future QueueBuster and POS Data

QueueBuster/POS tables are not implemented yet. When they are added, use these rules:

| Data | Retention class | Policy |
| --- | --- | --- |
| Raw QueueBuster CSV downloads | Google Drive archive only | Store original files in Drive immediately. Keep checksum, date range, store, source filename, and import status in Supabase forever. |
| Parsed POS staging rows | Supabase recent-window + Drive archive | Keep 45 days in Supabase for reconciliation debugging, then archive and delete after manifest verification. |
| POS reconciliation results | Supabase forever | Keep daily/store/flavour/product reconciliation summaries indefinitely. |
| QueueBuster job definitions and latest status | Supabase forever | Keep current schedules, store mapping, last run status, and last successful file manifest. |
| Detailed worker logs/screenshots | Google Drive archive only or 30-day Supabase window | Prefer Drive for files. Keep only compact status/error summaries in Supabase forever. |

## Never Archive

Do not write these to Supabase archive files or Google Drive archive files:

- Supabase service-role key, anon key rotation history, JWTs, auth session tokens, refresh tokens, or browser local storage.
- QueueBuster username, password, OTPs, cookies, session storage, or downloaded browser profile.
- Google Drive service-account credentials or OAuth refresh tokens.
- Full frontend environment files such as `.env.local`.
- Raw staff device permission state. Store only the submitted attendance evidence already present in `attendance_entries`.

Secrets belong in local environment variables for development and backend secret storage for production workers or Vercel/VM environments. The frontend must never receive Drive credentials, service-role keys, or QueueBuster credentials.

## Archive File Format

Use gzip-compressed JSON Lines for database rows:

- File extension: `.jsonl.gz`
- One JSON object per source row.
- Include source table, exported timestamp, schema version, primary key, and all row columns.
- Preserve UUIDs, timestamps, numerics, and JSONB without lossy formatting.
- Use UTC timestamps in ISO-8601 format.

For raw POS downloads, preserve the original QueueBuster CSV exactly as downloaded. If a normalized version is produced, store it as a separate `.jsonl.gz` file and link both files in the same manifest.

## Google Drive Folders and Names

Root folder:

```text
Snowy Operations Archive/
```

Folder structure:

```text
Snowy Operations Archive/
  production/
    YYYY/
      MM/
        operations/
        attendance/
        inventory/
        queuebuster/
          raw/
          parsed/
        manifests/
  staging/
    YYYY/
      MM/
        ...
```

Database archive file naming:

```text
{table}_{store-or-all}_{YYYY-MM-DD}_to_{YYYY-MM-DD}_{run_id}.jsonl.gz
```

Examples:

```text
attendance_entries_all_2026-05-01_to_2026-05-31_20260601T020000Z.jsonl.gz
end_of_day_count_items_rajpur_2026-05-01_to_2026-05-31_20260601T020000Z.jsonl.gz
```

Raw QueueBuster file naming:

```text
queuebuster_raw_{store_alias}_{report_type}_{YYYY-MM-DD}_to_{YYYY-MM-DD}_{downloaded_at}.csv
```

## Manifest and Checksum Strategy

Each archive run writes one manifest JSON file before any Supabase deletion:

```text
manifest_{environment}_{YYYY-MM}_{run_id}.json
```

The manifest must include:

- Archive run ID, environment, created timestamp, code version/commit, and actor/job ID.
- Source table or source file name.
- Supabase query predicate used for export.
- Row count, primary key list or primary key hash, min/max business date, and min/max created/updated timestamp.
- Destination Google Drive folder ID and file ID.
- File byte size and SHA-256 checksum for every archive file.
- Schema hash for each table export.
- Verification status and verification timestamp.
- Deletion status, deletion timestamp, and deleted row count if compaction ran.

Store manifest metadata in Supabase forever in future archive tables such as `archive_manifests` and `archive_files`. The Drive manifest file is the immutable cold-storage proof; the Supabase manifest rows are the searchable index.

The first implementation slice is dry-run only. Use `npm run archive:dry-run` on a backend machine or VM to generate a local manifest for a closed calendar month. That script reads Supabase through the service-role key, can optionally record the dry-run manifest in `archive_manifests` and `archive_files`, and never uploads to Drive or deletes rows. Operational instructions are in [archive-dry-run.md](../archive-dry-run.md).

## Summaries That Stay in Supabase

Before deleting any recent-window rows, write summary rows that preserve operational reporting:

- Daily store inventory summary: location, business date, flavour/item, opening balance, receipts, display movements, EOD display weight, EOD deep-freezer weight, adjustments, calculated closing balance.
- Daily lab summary: production batches, pan count, flavour weights, dispatched weights, remaining lab inventory.
- Daily dispatch/receipt summary: source, destination, status, pan count, planned weight, accepted weight, rejection count.
- Monthly attendance summary: user, location, work date, shift count, hours, bonus days, holiday adjustments, exception count.
- Urgent requirement summary: store, type, priority, lifecycle timestamps, fulfilment status, and response time.
- Future POS reconciliation summary: store, business date, POS item/flavour, POS quantity/sales, operations inventory delta, variance, and review status.

These summaries should be small enough to remain in Supabase forever and power Admin reporting without reading Drive files.

## Restore and Readback Procedure

1. Admin requests a date range, table, store, user, pan ID, or batch ID.
2. Backend worker searches Supabase manifest/index rows to identify matching archive files.
3. Worker downloads matching Drive files using backend-only Drive credentials.
4. Worker verifies SHA-256 checksums against the Supabase manifest and Drive manifest.
5. Worker loads rows into a temporary restore schema or local analysis file.
6. Admin reviews restored rows through an internal report or exported CSV.
7. Restored rows are not merged back into live tables unless a separate admin-approved repair plan is created.

For audits, prefer readback into a temporary table or downloadable report. Restoring into live tables should be rare and must require a written reason, actor ID, and backup of current live rows.

## Safety Rules

- Frontend code can read Supabase through normal RLS policies only. It must never access Google Drive APIs, Drive credentials, Supabase service-role credentials, or QueueBuster credentials.
- Archive and delete jobs must run only in a backend worker, VM, or trusted server environment.
- No Supabase deletion may run until the archive manifest has `verified` status, matching row counts, matching primary key hash, matching file byte size, and matching SHA-256 checksum.
- Deletion jobs must use the exact predicate recorded in the manifest and must record deleted row count.
- If deleted row count differs from manifest row count, stop the job and alert Admin.
- Archive jobs must be idempotent by run ID and table/date range.
- Keep at least one dry-run mode that writes a manifest candidate without uploading or deleting.
- Keep all inactive master data rows instead of deleting them when historical rows reference them.
- Legacy tables created by the initial migration rename flow (`legacy_*`) are outside the current app schema. If present, export them once to Drive with a manifest, verify with Admin, then leave them untouched until a separate cleanup issue is approved.
