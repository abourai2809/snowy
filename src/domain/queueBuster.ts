export const QUEUEBUSTER_JOB_TYPES = [
  "audit_flavour",
  "add_flavour",
  "fix_flavour",
  "catalog_products_check",
  "download_pos_csv",
  "reconcile_pos",
  "attendance_alert_check",
] as const;

export type QueueBusterJobType = (typeof QUEUEBUSTER_JOB_TYPES)[number];

export const QUEUEBUSTER_JOB_STATUSES = [
  "pending",
  "running",
  "needs_confirmation",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type QueueBusterJobStatus = (typeof QUEUEBUSTER_JOB_STATUSES)[number];

export type QueueBusterPayload = Record<string, unknown>;

export interface QueueBusterJob {
  id: string;
  jobType: QueueBusterJobType;
  status: QueueBusterJobStatus;
  instruction: string | null;
  requestPayload: QueueBusterPayload;
  resultPayload: QueueBusterPayload | null;
  auditJobId: string | null;
  requestedBy: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  runStartedAt: string | null;
  runCompletedAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueBusterJobEvent {
  id: string;
  jobId: string;
  eventType: string;
  status: QueueBusterJobStatus;
  message: string | null;
  safePayload: QueueBusterPayload | null;
  actorId: string | null;
  createdAt: string;
}

export const QUEUEBUSTER_JOB_TYPE_LABELS: Record<QueueBusterJobType, string> = {
  audit_flavour: "Audit flavour",
  add_flavour: "Add flavour",
  fix_flavour: "Fix flavour",
  catalog_products_check: "Catalog products check",
  download_pos_csv: "Download POS CSV",
  reconcile_pos: "Reconcile POS",
  attendance_alert_check: "Attendance alert check",
};

export const QUEUEBUSTER_JOB_STATUS_LABELS: Record<QueueBusterJobStatus, string> = {
  pending: "Pending",
  running: "Running",
  needs_confirmation: "Needs confirmation",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function requiresQueueBusterAudit(jobType: QueueBusterJobType): boolean {
  return jobType === "add_flavour" || jobType === "fix_flavour";
}
