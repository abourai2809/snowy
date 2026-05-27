# Attendance Selfie AI Checks

Attendance check-in requires a selfie. The app uploads the image to a private Supabase Storage bucket and creates a queued AI check. A backend worker reviews queued checks with Gemini and writes structured pass/needs-review results back to Supabase.

## Model Choice

Start with `gemini-2.5-flash-lite`.

Reasoning:
- The task is simple image understanding: apron visible, correct headwear/hair covering visible, gloved hand making thumbs-up.
- Expected volume is low: roughly 10-25 images per day.
- Google documents Gemini image understanding for image classification and visual question answering.
- Google describes Flash-Lite as the fastest and most budget-friendly multimodal model in the 2.5 family.

If sample photos show too many false positives or false negatives, switch `ATTENDANCE_SELFIE_MODEL` to `gemini-2.5-flash`.

## Data Flow

1. Staff selects work location and uploads check-in selfie.
2. App uploads the image to private bucket `attendance-selfies`.
3. App creates attendance row with `selfie_in_url` set to the private object path.
4. App creates `attendance_selfie_checks` row with status `queued`.
5. App calls `/api/attendance-selfie-checks` with the current login token and attendance entry id.
6. The Vercel backend verifies that the logged-in staff member owns the attendance entry, then downloads the queued image with the service-role key.
7. Backend calls Gemini and asks for strict JSON:
   - `apron`
   - `headwear`
   - `glove_thumbs_up`
   - `overall`
   - `confidence`
   - `notes`
8. Backend writes results to `attendance_selfie_checks`.
9. If the result needs review and `ATTENDANCE_SELFIE_ALERT_WEBHOOK_URL` is configured, backend sends an admin alert.
10. Admin/manager review views show queued/pass/needs-review status.

## Worker

The deployed Vercel API route processes the selfie immediately after check-in. The CLI/GitHub worker is still useful for manual backfills or retries.

Run once:

```bash
ATTENDANCE_SELFIE_RUN_ONCE=1 npm run worker:attendance-selfies
```

Run continuously:

```bash
npm run worker:attendance-selfies
```

Required worker-only environment:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
ATTENDANCE_SELFIE_MODEL=gemini-2.5-flash-lite
ATTENDANCE_SELFIE_ALERT_WEBHOOK_URL=
ATTENDANCE_SELFIE_ALERT_WEBHOOK_KIND=slack
ATTENDANCE_SELFIE_POLL_INTERVAL_MS=30000
ATTENDANCE_SELFIE_DRY_RUN=0
```

Use `ATTENDANCE_SELFIE_DRY_RUN=1` to verify queue processing without calling Gemini.

Use `ATTENDANCE_SELFIE_MAX_CHECKS=25` when running in a scheduled job. This drains up to 25 queued checks and then exits.

## GitHub Actions

The workflow `.github/workflows/attendance-selfie-checks.yml` is a manual backfill worker from the GitHub Actions tab.

Configure these repository secrets:

```bash
SUPABASE_URL=https://mbjiqmrsjjxputwveymi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

Optional repository variable:

```bash
ATTENDANCE_SELFIE_MODEL=gemini-2.5-flash-lite
```

Manual runs process up to 25 queued selfie checks and include a `dry_run` input for testing the queue without calling Gemini.

## Alerts

The first supported alert destination is a Slack-compatible incoming webhook. Configure this backend-only secret in Vercel and GitHub Actions if alerts should work in both places:

```bash
ATTENDANCE_SELFIE_ALERT_WEBHOOK_URL=
ATTENDANCE_SELFIE_ALERT_WEBHOOK_KIND=slack
```

Alerts are sent only when Gemini returns `needs_review` or the AI check fails. Dry runs never send alerts. The alert contains staff name, location, date, verdict fields, confidence, and notes. It does not attach the selfie image.

## Admin Review And Archival

Admin reports show check-in selfies for the recent review window, currently three days. The app creates short-lived signed Supabase Storage URLs for the preview; images remain private.

Older images should be moved to Google Drive by the archive worker:

```bash
npm run archive:attendance-selfies
```

Required backend-only archive environment:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=
GOOGLE_DRIVE_ATTENDANCE_SELFIE_FOLDER_ID=
ATTENDANCE_SELFIE_REVIEW_DAYS=3
ATTENDANCE_SELFIE_ARCHIVE_MAX=50
ATTENDANCE_SELFIE_ARCHIVE_DRY_RUN=0
```

The Google service account must have access to the target Drive folder. The worker uploads each old selfie to that folder, records `archive_provider`, `archive_path`, `archive_file_id`, and `archived_at` in `attendance_selfie_checks`, then removes the private Supabase Storage object and records `storage_deleted_at`.

## Review Posture

The AI should flag records, not block attendance. A failed or unclear result should become `needs_review` for Admin/manager. This avoids payroll disruption while we tune the prompt against real sample photos.

## Privacy

Selfies are staff images. Keep the bucket private, keep service-role keys only in backend secrets, and do not expose Gemini or Supabase service keys in frontend JavaScript.
