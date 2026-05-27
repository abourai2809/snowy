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
5. Worker downloads queued image with service-role key.
6. Worker calls Gemini and asks for strict JSON:
   - `apron`
   - `headwear`
   - `glove_thumbs_up`
   - `overall`
   - `confidence`
   - `notes`
7. Worker writes results to `attendance_selfie_checks`.
8. Admin/manager review views show queued/pass/needs-review status.

## Worker

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
ATTENDANCE_SELFIE_POLL_INTERVAL_MS=30000
ATTENDANCE_SELFIE_DRY_RUN=0
```

Use `ATTENDANCE_SELFIE_DRY_RUN=1` to verify queue processing without calling Gemini.

Use `ATTENDANCE_SELFIE_MAX_CHECKS=25` when running in a scheduled job. This drains up to 25 queued checks and then exits.

## GitHub Actions

The workflow `.github/workflows/attendance-selfie-checks.yml` runs every 5 minutes and can also be run manually from the GitHub Actions tab.

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

The scheduled action processes up to 25 queued selfie checks per run. Manual runs include a `dry_run` input for testing the queue without calling Gemini.

## Review Posture

The AI should flag records, not block attendance. A failed or unclear result should become `needs_review` for Admin/manager. This avoids payroll disruption while we tune the prompt against real sample photos.

## Privacy

Selfies are staff images. Keep the bucket private, keep service-role keys only in backend secrets, and do not expose Gemini or Supabase service keys in frontend JavaScript.
