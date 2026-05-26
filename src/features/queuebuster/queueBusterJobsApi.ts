import {
  QUEUEBUSTER_JOB_STATUSES,
  QUEUEBUSTER_JOB_TYPES,
  requiresQueueBusterAudit,
  type QueueBusterJob,
  type QueueBusterJobEvent,
  type QueueBusterJobStatus,
  type QueueBusterJobType,
  type QueueBusterPayload,
} from "../../domain/queueBuster";
import type { AppRole } from "../../domain/roles";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";

export interface QueueBusterJobInput {
  jobType: QueueBusterJobType;
  instruction?: string | null;
  requestPayload?: QueueBusterPayload;
  auditJobId?: string | null;
  requestedBy: string | null;
  actorRole: AppRole;
}

let demoJobs: QueueBusterJob[] = [];
let demoEvents: QueueBusterJobEvent[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertAdmin(actorRole: AppRole) {
  if (actorRole !== "admin") {
    throw new Error("Only Admin can manage QueueBuster jobs.");
  }
}

function assertKnownJobType(jobType: QueueBusterJobType) {
  if (!QUEUEBUSTER_JOB_TYPES.includes(jobType)) {
    throw new Error("Unsupported QueueBuster job type.");
  }
}

function assertKnownJobStatus(status: QueueBusterJobStatus) {
  if (!QUEUEBUSTER_JOB_STATUSES.includes(status)) {
    throw new Error("Unsupported QueueBuster job status.");
  }
}

function assertAuditGate(input: QueueBusterJobInput) {
  if (requiresQueueBusterAudit(input.jobType) && !input.auditJobId) {
    throw new Error("Audit job is required before add or fix jobs can be queued.");
  }
}

function mapJob(row: Record<string, unknown>): QueueBusterJob {
  return {
    id: String(row.id),
    jobType: row.job_type as QueueBusterJobType,
    status: row.status as QueueBusterJobStatus,
    instruction: row.instruction ? String(row.instruction) : null,
    requestPayload: (row.request_payload as QueueBusterPayload | null) ?? {},
    resultPayload: (row.result_payload as QueueBusterPayload | null) ?? null,
    auditJobId: row.audit_job_id ? String(row.audit_job_id) : null,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    confirmedBy: row.confirmed_by ? String(row.confirmed_by) : null,
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
    claimedBy: row.claimed_by ? String(row.claimed_by) : null,
    claimedAt: row.claimed_at ? String(row.claimed_at) : null,
    runStartedAt: row.run_started_at ? String(row.run_started_at) : null,
    runCompletedAt: row.run_completed_at ? String(row.run_completed_at) : null,
    attempts: Number(row.attempts ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Record<string, unknown>): QueueBusterJobEvent {
  return {
    id: String(row.id),
    jobId: String(row.queuebuster_job_id),
    eventType: String(row.event_type),
    status: row.status as QueueBusterJobStatus,
    message: row.message ? String(row.message) : null,
    safePayload: (row.safe_payload as QueueBusterPayload | null) ?? null,
    actorId: row.actor_id ? String(row.actor_id) : null,
    createdAt: String(row.created_at),
  };
}

function appendDemoEvent(
  job: QueueBusterJob,
  eventType: string,
  actorId: string | null,
  message: string | null,
  safePayload: QueueBusterPayload | null = null,
) {
  demoEvents.push({
    id: makeId("qb-event"),
    jobId: job.id,
    eventType,
    status: job.status,
    message,
    safePayload,
    actorId,
    createdAt: nowIso(),
  });
}

function assertAuditSucceeded(job: QueueBusterJob, jobs: QueueBusterJob[]) {
  if (!requiresQueueBusterAudit(job.jobType)) {
    return;
  }

  const audit = jobs.find((item) => item.id === job.auditJobId);
  if (!audit || audit.jobType !== "audit_flavour" || audit.status !== "succeeded") {
    throw new Error("Linked audit job must succeed before this QueueBuster job can be confirmed.");
  }
}

async function createQueueBusterJobEvent(
  jobId: string,
  eventType: string,
  status: QueueBusterJobStatus,
  actorId: string | null,
  message: string | null,
  safePayload: QueueBusterPayload | null = null,
): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("queuebuster_job_events")
    .insert({
      queuebuster_job_id: jobId,
      event_type: eventType,
      status,
      message,
      safe_payload: safePayload,
      actor_id: actorId,
    });

  if (error) throw error;
}

export function resetDemoQueueBusterData() {
  demoJobs = [];
  demoEvents = [];
}

export async function listQueueBusterJobs(): Promise<QueueBusterJob[]> {
  if (!isSupabaseConfigured) {
    return [...demoJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { data, error } = await requireSupabaseClient()
    .from("queuebuster_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapJob);
}

export async function listQueueBusterJobEvents(jobId: string): Promise<QueueBusterJobEvent[]> {
  if (!isSupabaseConfigured) {
    return demoEvents.filter((event) => event.jobId === jobId);
  }

  const { data, error } = await requireSupabaseClient()
    .from("queuebuster_job_events")
    .select("*")
    .eq("queuebuster_job_id", jobId)
    .order("created_at");

  if (error) throw error;
  return data.map(mapEvent);
}

export async function createQueueBusterJob(input: QueueBusterJobInput): Promise<QueueBusterJob> {
  assertAdmin(input.actorRole);
  assertKnownJobType(input.jobType);
  assertAuditGate(input);

  const status: QueueBusterJobStatus = requiresQueueBusterAudit(input.jobType) ? "needs_confirmation" : "pending";
  const instruction = input.instruction?.trim() || null;
  const requestPayload = input.requestPayload ?? {};

  if (!isSupabaseConfigured) {
    const timestamp = nowIso();
    const job: QueueBusterJob = {
      id: makeId("qb-job"),
      jobType: input.jobType,
      status,
      instruction,
      requestPayload,
      resultPayload: null,
      auditJobId: input.auditJobId ?? null,
      requestedBy: input.requestedBy,
      confirmedBy: null,
      confirmedAt: null,
      claimedBy: null,
      claimedAt: null,
      runStartedAt: null,
      runCompletedAt: null,
      attempts: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    demoJobs.push(job);
    appendDemoEvent(job, "created", input.requestedBy, null, { jobType: input.jobType });
    return { ...job };
  }

  const { data, error } = await requireSupabaseClient()
    .from("queuebuster_jobs")
    .insert({
      job_type: input.jobType,
      status,
      instruction,
      request_payload: requestPayload,
      audit_job_id: input.auditJobId ?? null,
      requested_by: input.requestedBy,
    })
    .select()
    .single();

  if (error) throw error;
  const job = mapJob(data);
  await createQueueBusterJobEvent(job.id, "created", job.status, input.requestedBy, null, { jobType: input.jobType });
  return job;
}

export async function confirmQueueBusterJob(
  jobId: string,
  actorId: string | null,
  actorRole: AppRole,
): Promise<QueueBusterJob> {
  assertAdmin(actorRole);
  const timestamp = nowIso();

  if (!isSupabaseConfigured) {
    const job = demoJobs.find((item) => item.id === jobId);
    if (!job) throw new Error("QueueBuster job not found.");
    if (job.status !== "needs_confirmation") {
      throw new Error("Only jobs waiting for confirmation can be confirmed.");
    }
    assertAuditSucceeded(job, demoJobs);

    job.status = "pending";
    job.confirmedBy = actorId;
    job.confirmedAt = timestamp;
    job.updatedAt = timestamp;
    appendDemoEvent(job, "confirmed", actorId, "Approved for worker execution.");
    return { ...job };
  }

  const { data: currentData, error: currentError } = await requireSupabaseClient()
    .from("queuebuster_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (currentError) throw currentError;
  const currentJob = mapJob(currentData);

  if (currentJob.status !== "needs_confirmation") {
    throw new Error("Only jobs waiting for confirmation can be confirmed.");
  }

  if (requiresQueueBusterAudit(currentJob.jobType)) {
    const { data: auditData, error: auditError } = await requireSupabaseClient()
      .from("queuebuster_jobs")
      .select("*")
      .eq("id", currentJob.auditJobId)
      .single();

    if (auditError) throw auditError;
    assertAuditSucceeded(currentJob, [mapJob(auditData)]);
  }

  const { data, error } = await requireSupabaseClient()
    .from("queuebuster_jobs")
    .update({
      status: "pending",
      confirmed_by: actorId,
      confirmed_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", jobId)
    .eq("status", "needs_confirmation")
    .select()
    .single();

  if (error) throw error;
  const job = mapJob(data);
  await createQueueBusterJobEvent(job.id, "confirmed", job.status, actorId, "Approved for worker execution.");
  return job;
}

export async function cancelQueueBusterJob(
  jobId: string,
  actorId: string | null,
  actorRole: AppRole,
): Promise<QueueBusterJob> {
  assertAdmin(actorRole);
  const timestamp = nowIso();

  if (!isSupabaseConfigured) {
    const job = demoJobs.find((item) => item.id === jobId);
    if (!job) throw new Error("QueueBuster job not found.");
    if (job.status === "succeeded" || job.status === "failed") {
      throw new Error("Completed QueueBuster jobs cannot be cancelled.");
    }

    job.status = "cancelled";
    job.runCompletedAt = timestamp;
    job.updatedAt = timestamp;
    appendDemoEvent(job, "cancelled", actorId, null);
    return { ...job };
  }

  const { data, error } = await requireSupabaseClient()
    .from("queuebuster_jobs")
    .update({
      status: "cancelled",
      run_completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", jobId)
    .not("status", "in", "(succeeded,failed)")
    .select()
    .single();

  if (error) throw error;
  const job = mapJob(data);
  await createQueueBusterJobEvent(job.id, "cancelled", job.status, actorId, null);
  return job;
}

export async function claimNextQueueBusterJob(workerId: string): Promise<QueueBusterJob | null> {
  if (!workerId.trim()) {
    throw new Error("Worker id is required.");
  }

  if (!isSupabaseConfigured) {
    const job = [...demoJobs]
      .filter((item) => item.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!job) return null;

    const timestamp = nowIso();
    job.status = "running";
    job.claimedBy = workerId;
    job.claimedAt = timestamp;
    job.runStartedAt = timestamp;
    job.attempts += 1;
    job.updatedAt = timestamp;
    appendDemoEvent(job, "claimed", null, `Claimed by ${workerId}.`, { workerId });
    return { ...job };
  }

  const { data, error } = await requireSupabaseClient()
    .rpc("claim_next_queuebuster_job", { worker_id: workerId.trim() });

  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows[0] ? mapJob(rows[0] as Record<string, unknown>) : null;
}

export async function completeQueueBusterJob(
  jobId: string,
  status: Extract<QueueBusterJobStatus, "succeeded" | "failed">,
  resultPayload: QueueBusterPayload | null,
  message: string | null,
): Promise<QueueBusterJob> {
  assertKnownJobStatus(status);
  const timestamp = nowIso();

  if (!isSupabaseConfigured) {
    const job = demoJobs.find((item) => item.id === jobId);
    if (!job) throw new Error("QueueBuster job not found.");
    job.status = status;
    job.resultPayload = resultPayload;
    job.lastError = status === "failed" ? message : null;
    job.runCompletedAt = timestamp;
    job.updatedAt = timestamp;
    appendDemoEvent(job, status, null, message, resultPayload);
    return { ...job };
  }

  const { data, error } = await requireSupabaseClient()
    .from("queuebuster_jobs")
    .update({
      status,
      result_payload: resultPayload,
      last_error: status === "failed" ? message : null,
      run_completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw error;
  const job = mapJob(data);
  await createQueueBusterJobEvent(job.id, status, job.status, null, message, resultPayload);
  return job;
}
