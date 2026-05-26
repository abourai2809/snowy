import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const COMMAND_ENV_BY_JOB_TYPE = {
  audit_flavour: "QUEUEBUSTER_AUDIT_FLAVOUR_CMD",
  add_flavour: "QUEUEBUSTER_ADD_FLAVOUR_CMD",
  fix_flavour: "QUEUEBUSTER_FIX_FLAVOUR_CMD",
  catalog_products_check: "QUEUEBUSTER_CATALOG_PRODUCTS_CHECK_CMD",
  download_pos_csv: "QUEUEBUSTER_DOWNLOAD_POS_CSV_CMD",
  reconcile_pos: "QUEUEBUSTER_RECONCILE_POS_CMD",
  attendance_alert_check: "QUEUEBUSTER_ATTENDANCE_ALERT_CHECK_CMD",
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId = process.env.QUEUEBUSTER_WORKER_ID || `queuebuster-worker-${process.pid}`;
const pollIntervalMs = Number(process.env.QUEUEBUSTER_POLL_INTERVAL_MS || 15_000);
const staleAfterMinutes = Number(process.env.QUEUEBUSTER_STALE_AFTER_MINUTES || 30);
const maxAttempts = Number(process.env.QUEUEBUSTER_MAX_ATTEMPTS || 3);
const runOnce = process.env.QUEUEBUSTER_RUN_ONCE === "1";
const dryRun = process.env.QUEUEBUSTER_DRY_RUN === "1";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, before running the worker.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  console.log(`QueueBuster worker started as ${workerId}${dryRun ? " (dry run)" : ""}.`);

  do {
    await processNextJob();
    if (!runOnce) {
      await delay(pollIntervalMs);
    }
  } while (!runOnce);
}

async function processNextJob() {
  await recoverStaleJobs();
  const job = await claimNextJob();
  if (!job) {
    if (runOnce) console.log("No pending QueueBuster jobs.");
    return;
  }

  await createEvent(job.id, "worker_started", "running", `Worker ${workerId} started ${job.job_type}.`, {
    workerId,
  });

  try {
    const result = dryRun ? buildDryRunResult(job) : await runAllowlistedCommand(job);
    await completeJob(job.id, "succeeded", result, result.summary ?? "QueueBuster job completed.");
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    await completeJob(job.id, "failed", { summary: message }, message);
  }
}

async function recoverStaleJobs() {
  const { error } = await supabase.rpc("recover_stale_queuebuster_jobs", {
    max_age_minutes: staleAfterMinutes,
    max_attempts: maxAttempts,
  });

  if (error) throw error;
}

async function claimNextJob() {
  const { data, error } = await supabase.rpc("claim_next_queuebuster_job", { worker_id: workerId });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows[0] ?? null;
}

async function runAllowlistedCommand(job) {
  const commandEnv = COMMAND_ENV_BY_JOB_TYPE[job.job_type];
  const command = commandEnv ? process.env[commandEnv] : undefined;

  if (!command) {
    throw new Error(`No allowlisted worker command configured for ${job.job_type}. Set ${commandEnv}.`);
  }

  const payload = JSON.stringify(buildJobPayload(job));
  const output = await runCommand(command, payload);

  return {
    summary: `${job.job_type} command finished with exit code ${output.exitCode}.`,
    stdout: redactSecrets(output.stdout),
    stderr: redactSecrets(output.stderr),
    exitCode: output.exitCode,
  };
}

function runCommand(command, stdinPayload) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      env: {
        ...process.env,
        QUEUEBUSTER_JOB_PAYLOAD: stdinPayload,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      stdout = truncate(stdout);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      stderr = truncate(stderr);
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode });
        return;
      }

      reject(new Error(`${command} failed with exit code ${exitCode}. ${stderr || stdout}`));
    });

    child.stdin.end(stdinPayload);
  });
}

async function completeJob(jobId, status, resultPayload, message) {
  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("queuebuster_jobs")
    .update({
      status,
      result_payload: resultPayload,
      last_error: status === "failed" ? message : null,
      run_completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", jobId);

  if (error) throw error;
  await createEvent(jobId, status, status, message, resultPayload);
}

async function createEvent(jobId, eventType, status, message, safePayload = null) {
  const { error } = await supabase
    .from("queuebuster_job_events")
    .insert({
      queuebuster_job_id: jobId,
      event_type: eventType,
      status,
      message,
      safe_payload: safePayload,
    });

  if (error) throw error;
}

function buildJobPayload(job) {
  return {
    id: job.id,
    jobType: job.job_type,
    instruction: job.instruction,
    requestPayload: job.request_payload ?? {},
    auditJobId: job.audit_job_id,
    workerId,
  };
}

function buildDryRunResult(job) {
  return {
    summary: `Dry run completed for ${job.job_type}.`,
    job: buildJobPayload(job),
  };
}

function redactSecrets(value) {
  let output = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (!secret || secret.length < 6) continue;
    if (!/(PASSWORD|SECRET|TOKEN|COOKIE|SESSION|KEY|QUEUEBUSTER)/i.test(key)) continue;
    output = output.split(secret).join("[redacted]");
  }
  return output;
}

function truncate(value, maxLength = 16_000) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n[truncated]`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
