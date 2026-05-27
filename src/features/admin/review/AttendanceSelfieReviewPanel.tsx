import { useEffect, useState } from "react";
import type { AttendanceEntry, AttendanceSelfieCheck, AttendanceSelfieReview } from "../../../domain/attendance";
import type { StaffProfile } from "../../../domain/roles";
import { listRecentAttendanceSelfieReviews } from "../../attendance/attendanceApi";
import { listStaff } from "../staff/staffApi";

export function AttendanceSelfieReviewPanel({ title = "Attendance selfie review" }: { title?: string }) {
  const [reviews, setReviews] = useState<AttendanceSelfieReview[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReviews() {
      const [reviewRows, staffRows] = await Promise.all([
        listRecentAttendanceSelfieReviews(3),
        listStaff(),
      ]);

      setReviews(reviewRows);
      setStaff(staffRows);
      setError(null);
    }

    void loadReviews().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load attendance selfies.");
    });
  }, []);

  const staffById = new Map(staff.map((item) => [item.id, item]));

  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {reviews.length === 0 ? <p className="muted-copy">No recent selfies.</p> : null}
      <SelfieReviewGrid reviews={reviews} staffById={staffById} />
    </section>
  );
}

function SelfieReviewGrid({
  reviews,
  staffById,
}: {
  reviews: AttendanceSelfieReview[];
  staffById: Map<string, StaffProfile>;
}) {
  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className="selfie-review-grid">
      {reviews.map((review) => (
        <article className="selfie-review-card" key={review.check?.id ?? review.entry.id}>
          <div className="selfie-review-image">
            {review.selfieUrl ? (
              <img
                src={review.selfieUrl}
                alt={`Attendance selfie for ${staffById.get(review.entry.userId)?.name ?? "staff"}`}
              />
            ) : (
              <span>{review.check?.archivedAt ? "Archived" : "Preview unavailable"}</span>
            )}
          </div>
          <div className="selfie-review-meta">
            <strong>{staffById.get(review.entry.userId)?.name ?? review.entry.userId}</strong>
            <span>
              {review.entry.locationId ?? "No location"} / {formatDateTime(review.entry.checkInAt)}
            </span>
            <span>{formatSelfieDetail(review.entry, review.check ?? undefined)}</span>
          </div>
          <span className="badge">{formatSelfieBadge(review.entry, review.check ?? undefined)}</span>
        </article>
      ))}
    </div>
  );
}

export function formatSelfieBadge(entry: AttendanceEntry, selfieCheck: AttendanceSelfieCheck | undefined): string {
  if (!entry.selfieInUrl) return entry.status;
  if (!selfieCheck) return "selfie queued";
  if (selfieCheck.status === "queued" || selfieCheck.status === "running") return `selfie ${selfieCheck.status}`;
  if (selfieCheck.status === "failed") return "selfie failed";
  return selfieCheck.overallStatus?.replace("_", " ") ?? "needs review";
}

export function formatSelfieDetail(entry: AttendanceEntry, selfieCheck: AttendanceSelfieCheck | undefined): string {
  if (!entry.selfieInUrl) return "No selfie";
  if (!selfieCheck) return "Selfie queued";
  if (selfieCheck.status === "queued" || selfieCheck.status === "running") return `Selfie ${selfieCheck.status}`;
  if (selfieCheck.status === "failed") return `Selfie failed: ${selfieCheck.errorMessage ?? "needs review"}`;

  const confidence = selfieCheck.confidence === null ? "confidence n/a" : `${Math.round(selfieCheck.confidence * 100)}% confidence`;
  const notes = selfieCheck.notes ? ` / ${selfieCheck.notes}` : "";
  return [
    `Selfie ${selfieCheck.overallStatus?.replace("_", " ") ?? "needs review"}`,
    `apron ${selfieCheck.apronStatus ?? "unclear"}`,
    `headwear ${selfieCheck.headwearStatus ?? "unclear"}`,
    `glove ${selfieCheck.gloveThumbsUpStatus ?? "unclear"}`,
    confidence,
  ].join(" / ") + notes;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
