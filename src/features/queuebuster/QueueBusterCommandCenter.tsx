import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  QUEUEBUSTER_JOB_TYPE_LABELS,
  QUEUEBUSTER_JOB_TYPES,
  QUEUEBUSTER_JOB_STATUS_LABELS,
  requiresQueueBusterAudit,
  type QueueBusterJob,
  type QueueBusterJobType,
} from "../../domain/queueBuster";
import { useAuth } from "../auth/AuthProvider";
import {
  cancelQueueBusterJob,
  confirmQueueBusterJob,
  createQueueBusterJob,
  listQueueBusterJobs,
} from "./queueBusterJobsApi";

export function QueueBusterCommandCenter() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<QueueBusterJob[]>([]);
  const [jobType, setJobType] = useState<QueueBusterJobType>("audit_flavour");
  const [flavourName, setFlavourName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [auditJobId, setAuditJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auditJobs = useMemo(
    () => jobs.filter((job) => job.jobType === "audit_flavour"),
    [jobs],
  );
  const jobsById = useMemo(
    () => new Map(jobs.map((job) => [job.id, job])),
    [jobs],
  );
  const needsAudit = requiresQueueBusterAudit(jobType);

  async function refresh() {
    setLoading(true);
    try {
      setJobs(await listQueueBusterJobs());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load QueueBuster jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await createQueueBusterJob({
        actorRole: profile.role,
        requestedBy: profile.id,
        jobType,
        instruction,
        auditJobId: needsAudit ? auditJobId : null,
        requestPayload: buildRequestPayload(jobType, flavourName),
      });
      setMessage(needsAudit ? "QueueBuster job is waiting for audit completion and confirmation." : "QueueBuster job queued.");
      setInstruction("");
      if (!needsAudit) setFlavourName("");
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create QueueBuster job.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(job: QueueBusterJob) {
    if (!profile) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await confirmQueueBusterJob(job.id, profile.id, profile.role);
      setMessage("QueueBuster job approved for worker execution.");
      await refresh();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Unable to confirm QueueBuster job.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(job: QueueBusterJob) {
    if (!profile) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await cancelQueueBusterJob(job.id, profile.id, profile.role);
      setMessage("QueueBuster job cancelled.");
      await refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel QueueBuster job.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile || profile.role !== "admin") {
    return <div className="alert alert-danger">Only Admin can access QueueBuster jobs.</div>;
  }

  return (
    <div className="page-stack">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <section className="card">
        <div className="card-title">QueueBuster jobs</div>
        <form aria-label="QueueBuster job form" onSubmit={handleCreateJob}>
          <label className="field">
            <span>Action</span>
            <select value={jobType} onChange={(event) => setJobType(event.target.value as QueueBusterJobType)}>
              {QUEUEBUSTER_JOB_TYPES.map((type) => (
                <option value={type} key={type}>
                  {QUEUEBUSTER_JOB_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          {jobType === "audit_flavour" || jobType === "add_flavour" || jobType === "fix_flavour" ? (
            <label className="field">
              <span>Flavour name</span>
              <input
                value={flavourName}
                onChange={(event) => setFlavourName(event.target.value)}
                placeholder="QueueBuster flavour name"
                required
              />
            </label>
          ) : null}

          {needsAudit ? (
            <label className="field">
              <span>Audit job</span>
              <select value={auditJobId} onChange={(event) => setAuditJobId(event.target.value)} required>
                <option value="">Select audit</option>
                {auditJobs.map((job) => (
                  <option value={job.id} key={job.id}>
                    {getJobTitle(job)} / {QUEUEBUSTER_JOB_STATUS_LABELS[job.status]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>Instruction</span>
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Optional details for the worker"
              rows={3}
            />
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={submitting || (needsAudit && !auditJobId)}
          >
            Create QueueBuster job
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-title">Recent jobs</div>
        {loading ? <p className="muted-copy">Loading QueueBuster jobs...</p> : null}
        {!loading && jobs.length === 0 ? <p className="muted-copy">No QueueBuster jobs yet.</p> : null}
        <div className="list-stack" aria-label="QueueBuster jobs">
          {jobs.map((job) => (
            <article className="list-row vertical-row" key={job.id}>
              <div>
                <strong>{getJobTitle(job)}</strong>
                <span>{QUEUEBUSTER_JOB_TYPE_LABELS[job.jobType]}</span>
                {job.instruction ? <span>{job.instruction}</span> : null}
                {job.lastError ? <span>{job.lastError}</span> : null}
                {job.resultPayload ? <span>{formatPayload(job.resultPayload)}</span> : null}
                {requiresQueueBusterAudit(job.jobType) && job.auditJobId ? (
                  <span>{getAuditStatusLabel(jobsById.get(job.auditJobId))}</span>
                ) : null}
              </div>
              <span className="badge">{QUEUEBUSTER_JOB_STATUS_LABELS[job.status]}</span>
              {job.status === "needs_confirmation" ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void handleConfirm(job)}
                  disabled={submitting || !canConfirm(job, jobsById)}
                >
                  {canConfirm(job, jobsById) ? "Confirm live run" : "Audit pending"}
                </button>
              ) : null}
              {["pending", "running", "needs_confirmation"].includes(job.status) ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void handleCancel(job)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function buildRequestPayload(jobType: QueueBusterJobType, flavourName: string) {
  if (jobType === "audit_flavour" || jobType === "add_flavour" || jobType === "fix_flavour") {
    return { flavourName: flavourName.trim().toUpperCase() };
  }

  return {};
}

function getJobTitle(job: QueueBusterJob): string {
  const flavourName = typeof job.requestPayload.flavourName === "string" ? job.requestPayload.flavourName : null;
  return flavourName ?? QUEUEBUSTER_JOB_TYPE_LABELS[job.jobType];
}

function canConfirm(job: QueueBusterJob, jobsById: Map<string, QueueBusterJob>): boolean {
  if (!requiresQueueBusterAudit(job.jobType)) {
    return true;
  }

  return job.auditJobId ? jobsById.get(job.auditJobId)?.status === "succeeded" : false;
}

function getAuditStatusLabel(auditJob: QueueBusterJob | undefined): string {
  if (!auditJob) {
    return "Audit: missing";
  }

  return `Audit: ${QUEUEBUSTER_JOB_STATUS_LABELS[auditJob.status]}`;
}

function formatPayload(payload: Record<string, unknown>): string {
  const summary = payload.summary;
  if (typeof summary === "string") {
    return summary;
  }

  return JSON.stringify(payload);
}
