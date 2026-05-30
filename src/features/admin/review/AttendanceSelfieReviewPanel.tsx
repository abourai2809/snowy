import { useEffect, useState } from "react";
import { getTodayKey, type AttendanceEntry, type AttendanceSelfieCheck, type AttendanceSelfieReview } from "../../../domain/attendance";
import type { LocationOption, StaffProfile } from "../../../domain/roles";
import { listAttendanceSelfieReviewsForDate } from "../../attendance/attendanceApi";
import { listLocations, listStaff } from "../staff/staffApi";

function currentDate(): string {
  return getTodayKey();
}

export function AttendanceSelfieReviewPanel({ title = "Attendance selfie review" }: { title?: string }) {
  const [selfieDate, setSelfieDate] = useState(currentDate);
  const [locationFilter, setLocationFilter] = useState("");
  const [reviews, setReviews] = useState<AttendanceSelfieReview[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReviews() {
      const [reviewRows, staffRows, locationRows] = await Promise.all([
        listAttendanceSelfieReviewsForDate(selfieDate, locationFilter),
        listStaff(),
        listLocations(),
      ]);

      setReviews(reviewRows);
      setStaff(staffRows);
      setLocations(locationRows);
      setError(null);
    }

    void loadReviews().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load attendance selfies.");
    });
  }, [locationFilter, selfieDate]);

  const staffById = new Map(staff.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const storeLocations = locations.filter((location) => location.type === "store");

  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      <div className="review-controls selfie-review-controls">
        <label className="field compact-field">
          <span>Date</span>
          <input
            aria-label="Selfie date"
            type="date"
            value={selfieDate}
            onChange={(event) => setSelfieDate(event.target.value || currentDate())}
          />
        </label>
        <label className="field compact-field">
          <span>Store</span>
          <select
            aria-label="Selfie store"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            <option value="">All stores</option>
            {storeLocations.map((location) => (
              <option value={location.id} key={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {reviews.length === 0 ? <p className="muted-copy">No selfies match this date and store.</p> : null}
      <SelfieReviewGrid reviews={reviews} staffById={staffById} locationById={locationById} />
    </section>
  );
}

function SelfieReviewGrid({
  reviews,
  staffById,
  locationById,
}: {
  reviews: AttendanceSelfieReview[];
  staffById: Map<string, StaffProfile>;
  locationById: Map<string, LocationOption>;
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
              {locationName(review.entry.locationId, locationById)} / {formatDateTime(review.entry.checkInAt)}
            </span>
            <span>{formatSelfieDetail(review.entry, review.check ?? undefined)}</span>
          </div>
          <span className="badge">{formatSelfieBadge(review.entry, review.check ?? undefined)}</span>
        </article>
      ))}
    </div>
  );
}

function locationName(locationId: string | null, locationById: Map<string, LocationOption>): string {
  if (!locationId) return "No location";
  return locationById.get(locationId)?.name ?? locationId;
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
