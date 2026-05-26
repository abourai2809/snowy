import { beforeEach, describe, expect, it } from "vitest";
import {
  claimNextQueueBusterJob,
  completeQueueBusterJob,
  confirmQueueBusterJob,
  createQueueBusterJob,
  listQueueBusterJobEvents,
  listQueueBusterJobs,
  resetDemoQueueBusterData,
} from "./queueBusterJobsApi";

describe("queueBusterJobsApi", () => {
  beforeEach(() => {
    resetDemoQueueBusterData();
  });

  it("lets Admin create an audit job", async () => {
    const job = await createQueueBusterJob({
      jobType: "audit_flavour",
      instruction: "Audit BELGIAN CHOCOLATE",
      requestPayload: { flavourName: "BELGIAN CHOCOLATE" },
      requestedBy: "staff-admin",
      actorRole: "admin",
    });

    expect(job.status).toBe("pending");
    expect(job.jobType).toBe("audit_flavour");
    expect(job.requestPayload).toEqual({ flavourName: "BELGIAN CHOCOLATE" });
    expect(await listQueueBusterJobs()).toHaveLength(1);
  });

  it("blocks non-Admin job creation", async () => {
    await expect(createQueueBusterJob({
      jobType: "audit_flavour",
      requestedBy: "staff-store",
      actorRole: "store_staff",
    })).rejects.toThrow("Only Admin");
  });

  it("requires audit linkage before add or fix jobs", async () => {
    await expect(createQueueBusterJob({
      jobType: "add_flavour",
      requestPayload: { flavourName: "POPCORN" },
      requestedBy: "staff-admin",
      actorRole: "admin",
    })).rejects.toThrow("Audit job is required");
  });

  it("gates add and fix jobs behind explicit confirmation", async () => {
    const audit = await createQueueBusterJob({
      jobType: "audit_flavour",
      requestPayload: { flavourName: "POPCORN" },
      requestedBy: "staff-admin",
      actorRole: "admin",
    });
    const add = await createQueueBusterJob({
      jobType: "add_flavour",
      auditJobId: audit.id,
      requestPayload: { flavourName: "POPCORN" },
      requestedBy: "staff-admin",
      actorRole: "admin",
    });

    expect(add.status).toBe("needs_confirmation");
    await expect(confirmQueueBusterJob(add.id, "staff-admin", "admin")).rejects.toThrow("Linked audit job must succeed");

    await completeQueueBusterJob(audit.id, "succeeded", { matches: [] }, null);

    const confirmed = await confirmQueueBusterJob(add.id, "staff-admin", "admin");
    expect(confirmed.status).toBe("pending");
    expect(confirmed.confirmedBy).toBe("staff-admin");

    const events = await listQueueBusterJobEvents(add.id);
    expect(events.map((event) => event.eventType)).toEqual(["created", "confirmed"]);
  });

  it("lets a worker claim one pending job at a time", async () => {
    await createQueueBusterJob({
      jobType: "audit_flavour",
      requestPayload: { flavourName: "CHIKOO" },
      requestedBy: "staff-admin",
      actorRole: "admin",
    });
    await createQueueBusterJob({
      jobType: "audit_flavour",
      requestPayload: { flavourName: "COFFEE" },
      requestedBy: "staff-admin",
      actorRole: "admin",
    });

    const claimed = await claimNextQueueBusterJob("worker-local");
    expect(claimed?.status).toBe("running");
    expect(claimed?.claimedBy).toBe("worker-local");

    const jobs = await listQueueBusterJobs();
    expect(jobs.filter((job) => job.status === "running")).toHaveLength(1);
    expect(jobs.filter((job) => job.status === "pending")).toHaveLength(1);
  });
});
