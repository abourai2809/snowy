# QueueBuster Worker

The Snowy Operations frontend creates safe QueueBuster job requests in Supabase. A backend worker on this Mac or the future VM claims those jobs and runs the local QueueBuster automation. QueueBuster credentials must stay only in local worker secrets, never in Git, frontend JavaScript, Vercel env exposed to the browser, or Supabase job payloads.

## Runtime

Run from a machine that has Node.js, browser automation dependencies, the QueueBuster skills/commands, and local secrets:

```bash
npm run worker:queuebuster
```

The worker:

- Calls `claim_next_queuebuster_job(worker_id)` with a Supabase service-role key.
- Claims one `pending` job at a time.
- Writes job events to `queuebuster_job_events`.
- Executes only an allowlisted command from local environment variables.
- Sends the job payload to the command through stdin and `QUEUEBUSTER_JOB_PAYLOAD`.
- Marks the job `succeeded` or `failed` with redacted output.

## Required Environment

Use an ignored file on the worker, for example `$HOME/.codex/secrets/snowy-queuebuster-worker.env`:

```bash
SUPABASE_URL=https://mbjiqmrsjjxputwveymi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
QUEUEBUSTER_WORKER_ID=mac-worker-1
QUEUEBUSTER_POLL_INTERVAL_MS=15000
QUEUEBUSTER_DRY_RUN=0
QUEUEBUSTER_AUDIT_FLAVOUR_CMD="..."
QUEUEBUSTER_ADD_FLAVOUR_CMD="..."
QUEUEBUSTER_FIX_FLAVOUR_CMD="..."
QUEUEBUSTER_CATALOG_PRODUCTS_CHECK_CMD="..."
```

Do not put QueueBuster username, password, cookies, browser profile, or Supabase service-role key in `.env.local` for the frontend or in Vercel public variables.

## Command Contract

Each configured command receives a JSON payload through stdin and `QUEUEBUSTER_JOB_PAYLOAD`:

```json
{
  "id": "queuebuster job uuid",
  "jobType": "audit_flavour",
  "instruction": "optional admin instruction",
  "requestPayload": {
    "flavourName": "POPCORN"
  },
  "auditJobId": null,
  "workerId": "mac-worker-1"
}
```

The command should exit `0` on success and non-zero on failure. Stdout/stderr are stored as safe result context after basic secret redaction, so commands should avoid printing credentials or cookies.

## Dry Run

Set `QUEUEBUSTER_DRY_RUN=1` to claim jobs and complete them with a simulated result. This is useful for testing Supabase, RLS, and Admin UI status updates before live QueueBuster automation is connected.

## One-Time Run

For manual debugging:

```bash
QUEUEBUSTER_RUN_ONCE=1 QUEUEBUSTER_DRY_RUN=1 npm run worker:queuebuster
```

## Production VM Notes

On the VM, run the worker under `systemd`, `pm2`, or another process manager. Store secrets outside the repo with file permissions restricted to the worker user. The worker uses the service-role key, so it must not run on a shared staff device.
