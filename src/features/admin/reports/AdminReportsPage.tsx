import { useEffect, useState } from "react";
import {
  calculateHours,
  type AttendanceEntry,
  type AttendanceSelfieCheck,
  type AttendanceSelfieReview,
} from "../../../domain/attendance";
import type { Dispatch } from "../../../domain/dispatches";
import type { DeepFreezerCountWithItems } from "../../../domain/inventory";
import type { LocationOption, StaffProfile } from "../../../domain/roles";
import type { InventoryCountWithItems } from "../../../domain/supplies";
import { listLocations, listStaff } from "../staff/staffApi";
import {
  listAttendanceForDate,
  listAttendanceForMonth,
  listRecentAttendanceSelfieReviews,
  listSelfieChecksForAttendanceIds,
} from "../../attendance/attendanceApi";
import { listInventoryCounts } from "../../inventory/inventoryApi";
import { listLabDispatches } from "../../lab/labApi";
import { listDeepFreezerCounts, MORNING_VERIFICATION_TOLERANCE_KG } from "../../store/deepFreezerApi";
import { listEmptyPanCountsByStore, listEodGelatoCounts, type EodCountWithItems, type StoreEmptyPanCount } from "../../store/storeApi";
import { CorrectionsPage } from "../corrections/CorrectionsPage";
import { EodGelatoCorrectionsPage } from "../corrections/EodGelatoCorrectionsPage";
import { AdminDeepFreezerTools } from "./AdminDeepFreezerTools";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface AttendanceReviewRow {
  id: string;
  date: string;
  userId: string;
  staffName: string;
  locationId: string | null;
  locationName: string;
  shiftCount: number;
  firstCheckInAt: string;
  lastCheckOutAt: string | null;
  totalHours: number;
  requiredHours: number;
  openShiftCount: number;
  selfiePassCount: number;
  selfiePendingCount: number;
  selfieNeedsReviewCount: number;
  selfieMissingCount: number;
  credit: string;
}

export function AdminReportsPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [gelatoCounts, setGelatoCounts] = useState<EodCountWithItems[]>([]);
  const [morningChecks, setMorningChecks] = useState<DeepFreezerCountWithItems[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCountWithItems[]>([]);
  const [emptyPanCounts, setEmptyPanCounts] = useState<StoreEmptyPanCount[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceEntry[]>([]);
  const [selfieChecks, setSelfieChecks] = useState<AttendanceSelfieCheck[]>([]);
  const [monthlySelfieChecks, setMonthlySelfieChecks] = useState<AttendanceSelfieCheck[]>([]);
  const [recentSelfies, setRecentSelfies] = useState<AttendanceSelfieReview[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(currentMonth);
  const [staffFilter, setStaffFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      const [
        dispatchRows,
        gelatoRows,
        morningRows,
        inventoryRows,
        emptyPanRows,
        attendanceRows,
        monthlyAttendanceRows,
        staffRows,
        locationRows,
        selfieReviewRows,
      ] = await Promise.all([
        listLabDispatches(),
        listEodGelatoCounts(),
        listDeepFreezerCounts("morning"),
        listInventoryCounts(),
        listEmptyPanCountsByStore(),
        listAttendanceForDate(todayDate()),
        listAttendanceForMonth(attendanceMonth),
        listStaff(),
        listLocations(),
        listRecentAttendanceSelfieReviews(3),
      ]);
      const selfieRows = await listSelfieChecksForAttendanceIds(attendanceRows.map((entry) => entry.id));
      const monthlySelfieRows = await listSelfieChecksForAttendanceIds(monthlyAttendanceRows.map((entry) => entry.id));

      setDispatches(dispatchRows);
      setGelatoCounts(gelatoRows);
      setMorningChecks(morningRows);
      setInventoryCounts(inventoryRows);
      setEmptyPanCounts(emptyPanRows);
      setAttendance(attendanceRows);
      setMonthlyAttendance(monthlyAttendanceRows);
      setSelfieChecks(selfieRows);
      setMonthlySelfieChecks(monthlySelfieRows);
      setRecentSelfies(selfieReviewRows);
      setStaff(staffRows);
      setLocations(locationRows);
    }

    void loadReports().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load reports."));
  }, [attendanceMonth]);

  const staffById = new Map(staff.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const selfieCheckByEntryId = new Map(selfieChecks.map((check) => [check.attendanceEntryId, check]));
  const monthlySelfieCheckByEntryId = new Map(monthlySelfieChecks.map((check) => [check.attendanceEntryId, check]));
  const attendanceReviewRows = buildAttendanceReviewRows(
    monthlyAttendance,
    monthlySelfieCheckByEntryId,
    staffById,
    locationById,
  ).filter((row) => {
    if (staffFilter && row.userId !== staffFilter) return false;
    if (locationFilter && row.locationId !== locationFilter) return false;
    return true;
  });

  return (
    <div className="page-stack">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      <section className="card">
        <div className="card-title">Recent dispatches</div>
        {dispatches.length === 0 ? <p className="muted-copy">No dispatches yet.</p> : null}
        <div className="list-stack">
          {dispatches.slice(0, 5).map((dispatch) => (
            <div className="list-row" key={dispatch.id}>
              <div>
                <strong>{dispatch.dispatchCode}</strong>
                <span>
                  {dispatch.fromLocationId} to {dispatch.toLocationId}
                </span>
              </div>
              <span className="badge">{dispatch.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">EOD gelato</div>
        {gelatoCounts.length === 0 ? <p className="muted-copy">No gelato counts yet.</p> : null}
        <ReportRows
          rows={gelatoCounts.map((count) => ({
            id: count.id,
            title: count.locationId,
            detail: `${count.businessDate} / ${count.items.length} gelato lines`,
            badge: count.status,
          }))}
        />
      </section>

      <section className="card">
        <div className="card-title">Morning freezer checks</div>
        {morningChecks.length === 0 ? <p className="muted-copy">No morning checks yet.</p> : null}
        <ReportRows
          rows={morningChecks.slice(0, 10).map((count) => {
            const discrepancies = count.items.filter(
              (item) => Math.abs(item.varianceKg ?? 0) > MORNING_VERIFICATION_TOLERANCE_KG,
            ).length;
            return {
              id: count.id,
              title: count.locationId,
              detail: `${count.businessDate} / ${count.items.length} flavours`,
              badge: discrepancies > 0 ? `${discrepancies} flags` : "verified",
            };
          })}
        />
      </section>

      <section className="card">
        <div className="card-title">Supply counts</div>
        {inventoryCounts.length === 0 ? <p className="muted-copy">No supply counts yet.</p> : null}
        <ReportRows
          rows={inventoryCounts.map((count) => ({
            id: count.id,
            title: count.locationId,
            detail: `${count.businessDate} / ${count.items.length} items`,
            badge: count.status,
          }))}
        />
      </section>

      <section className="card">
        <div className="card-title">Empty pans</div>
        {emptyPanCounts.length === 0 ? <p className="muted-copy">No empty pans recorded.</p> : null}
        <ReportRows
          rows={emptyPanCounts.map((count) => ({
            id: count.locationId,
            title: count.locationId,
            detail: "Closed display pans at store",
            badge: `${count.emptyPanCount}`,
          }))}
        />
      </section>

      <section className="card attendance-review-card">
        <div className="card-title">Monthly attendance review</div>
        <div className="review-controls">
          <label className="field compact-field">
            <span>Month</span>
            <input
              aria-label="Attendance month"
              type="month"
              value={attendanceMonth}
              onChange={(event) => setAttendanceMonth(event.target.value || currentMonth())}
            />
          </label>
          <label className="field compact-field">
            <span>Employee</span>
            <select
              aria-label="Filter employee"
              value={staffFilter}
              onChange={(event) => setStaffFilter(event.target.value)}
            >
              <option value="">All employees</option>
              {staff.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span>Location</span>
            <select
              aria-label="Filter location"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <AttendanceReviewSummary rows={attendanceReviewRows} />
        <AttendanceReviewTable rows={attendanceReviewRows} />
      </section>

      <section className="card">
        <div className="card-title">Today roster</div>
        {attendance.length === 0 ? <p className="muted-copy">No attendance yet today.</p> : null}
        <ReportRows
          rows={attendance.map((entry) => ({
            id: entry.id,
            title: staffById.get(entry.userId)?.name ?? entry.userId,
            detail: formatAttendanceDetail(entry, selfieCheckByEntryId.get(entry.id)),
            badge: formatSelfieBadge(entry, selfieCheckByEntryId.get(entry.id)),
          }))}
        />
      </section>

      <section className="card">
        <div className="card-title">Recent attendance selfies</div>
        {recentSelfies.length === 0 ? <p className="muted-copy">No recent selfies.</p> : null}
        <SelfieReviewGrid reviews={recentSelfies} staffById={staffById} />
      </section>

      <AdminDeepFreezerTools />
      <EodGelatoCorrectionsPage />
      <CorrectionsPage />
    </div>
  );
}

function buildAttendanceReviewRows(
  entries: AttendanceEntry[],
  selfieCheckByEntryId: Map<string, AttendanceSelfieCheck>,
  staffById: Map<string, StaffProfile>,
  locationById: Map<string, LocationOption>,
): AttendanceReviewRow[] {
  const rows = new Map<string, AttendanceReviewRow>();

  for (const entry of entries) {
    const staff = staffById.get(entry.userId);
    const location = entry.locationId ? locationById.get(entry.locationId) : undefined;
    const key = `${entry.workDate}|${entry.userId}|${entry.locationId ?? "none"}`;
    const requiredHours = staff?.requiredHoursPerDay ?? 8;
    const existing = rows.get(key) ?? {
      id: key,
      date: entry.workDate,
      userId: entry.userId,
      staffName: staff?.name ?? entry.userId,
      locationId: entry.locationId,
      locationName: location?.name ?? entry.locationId ?? "No location",
      shiftCount: 0,
      firstCheckInAt: entry.checkInAt,
      lastCheckOutAt: null,
      totalHours: 0,
      requiredHours,
      openShiftCount: 0,
      selfiePassCount: 0,
      selfiePendingCount: 0,
      selfieNeedsReviewCount: 0,
      selfieMissingCount: 0,
      credit: "No hours",
    };

    existing.shiftCount += 1;
    if (new Date(entry.checkInAt).getTime() < new Date(existing.firstCheckInAt).getTime()) {
      existing.firstCheckInAt = entry.checkInAt;
    }

    if (entry.checkOutAt) {
      existing.totalHours += entry.hours ?? calculateHours(entry.checkInAt, entry.checkOutAt);
      if (!existing.lastCheckOutAt || new Date(entry.checkOutAt).getTime() > new Date(existing.lastCheckOutAt).getTime()) {
        existing.lastCheckOutAt = entry.checkOutAt;
      }
    } else {
      existing.openShiftCount += 1;
    }

    applySelfieStatus(existing, entry, selfieCheckByEntryId.get(entry.id));
    existing.credit = classifyAttendanceCredit(existing.totalHours, existing.requiredHours, existing.openShiftCount);
    rows.set(key, existing);
  }

  return [...rows.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.staffName !== b.staffName) return a.staffName.localeCompare(b.staffName);
    return a.locationName.localeCompare(b.locationName);
  });
}

function applySelfieStatus(
  row: AttendanceReviewRow,
  entry: AttendanceEntry,
  selfieCheck: AttendanceSelfieCheck | undefined,
) {
  if (!entry.selfieInUrl) {
    row.selfieMissingCount += 1;
    return;
  }

  if (!selfieCheck || selfieCheck.status === "queued" || selfieCheck.status === "running") {
    row.selfiePendingCount += 1;
    return;
  }

  if (selfieCheck.status === "failed" || selfieCheck.overallStatus === "needs_review") {
    row.selfieNeedsReviewCount += 1;
    return;
  }

  row.selfiePassCount += 1;
}

function classifyAttendanceCredit(totalHours: number, requiredHours: number, openShiftCount: number): string {
  if (openShiftCount > 0) return "Open shift";
  if (totalHours >= requiredHours) return "Full day";
  if (totalHours >= requiredHours / 2) return "Half day";
  if (totalHours > 0) return "Short day";
  return "No hours";
}

function AttendanceReviewSummary({ rows }: { rows: AttendanceReviewRow[] }) {
  const totalHours = rows.reduce((total, row) => total + row.totalHours, 0);
  const fullDays = rows.filter((row) => row.credit === "Full day").length;
  const halfDays = rows.filter((row) => row.credit === "Half day").length;
  const openShifts = rows.reduce((total, row) => total + row.openShiftCount, 0);

  return (
    <div className="attendance-review-summary">
      <div>
        <span>Rows</span>
        <strong>{rows.length}</strong>
      </div>
      <div>
        <span>Hours</span>
        <strong>{formatHours(totalHours)}</strong>
      </div>
      <div>
        <span>Full</span>
        <strong>{fullDays}</strong>
      </div>
      <div>
        <span>Half</span>
        <strong>{halfDays}</strong>
      </div>
      <div>
        <span>Open</span>
        <strong>{openShifts}</strong>
      </div>
    </div>
  );
}

function AttendanceReviewTable({ rows }: { rows: AttendanceReviewRow[] }) {
  if (rows.length === 0) {
    return <p className="muted-copy">No attendance entries match this month and filter.</p>;
  }

  return (
    <div className="review-table-wrap">
      <table className="review-table" aria-label="Monthly attendance review">
        <thead>
          <tr>
            <th>Date</th>
            <th>Employee</th>
            <th>Location</th>
            <th>Shifts</th>
            <th>In</th>
            <th>Out</th>
            <th>Hours</th>
            <th>Credit</th>
            <th>Selfie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.date)}</td>
              <td>
                <strong>{row.staffName}</strong>
                <small>{row.requiredHours}h required</small>
              </td>
              <td>{row.locationName}</td>
              <td>{row.shiftCount}</td>
              <td>{formatTime(row.firstCheckInAt)}</td>
              <td>{row.lastCheckOutAt ? formatTime(row.lastCheckOutAt) : "Open"}</td>
              <td>{formatHours(row.totalHours)}</td>
              <td>
                <span className="status-pill">{row.credit}</span>
              </td>
              <td>{formatReviewSelfieStatus(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatAttendanceDetail(entry: AttendanceEntry, selfieCheck: AttendanceSelfieCheck | undefined): string {
  const location = entry.locationId ?? "No location";
  const checkIn = entry.checkInLocation
    ? `In ${entry.checkInLocation.distanceM ?? "n/a"}m / acc ${entry.checkInLocation.accuracyM ?? "n/a"}m`
    : "In location not captured";
  const checkOut = entry.checkOutLocation
    ? `Out ${entry.checkOutLocation.distanceM ?? "n/a"}m / acc ${entry.checkOutLocation.accuracyM ?? "n/a"}m`
    : entry.checkOutAt
      ? "Out location not captured"
      : "Still checked in";
  return `${location} - ${checkIn} - ${checkOut} - ${formatSelfieDetail(entry, selfieCheck)}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatReviewSelfieStatus(row: AttendanceReviewRow): string {
  if (row.selfieNeedsReviewCount > 0) return `${row.selfieNeedsReviewCount} needs review`;
  if (row.selfiePendingCount > 0) return `${row.selfiePendingCount} pending`;
  if (row.selfieMissingCount > 0) return `${row.selfieMissingCount} missing`;
  if (row.selfiePassCount > 0) return "Pass";
  return "No selfie";
}

function formatSelfieBadge(entry: AttendanceEntry, selfieCheck: AttendanceSelfieCheck | undefined): string {
  if (!entry.selfieInUrl) return entry.status;
  if (!selfieCheck) return "selfie queued";
  if (selfieCheck.status === "queued" || selfieCheck.status === "running") return `selfie ${selfieCheck.status}`;
  if (selfieCheck.status === "failed") return "selfie failed";
  return selfieCheck.overallStatus?.replace("_", " ") ?? "needs review";
}

function formatSelfieDetail(entry: AttendanceEntry, selfieCheck: AttendanceSelfieCheck | undefined): string {
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

function ReportRows({ rows }: { rows: Array<{ id: string; title: string; detail: string; badge: string }> }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="list-stack">
      {rows.map((row) => (
        <div className="list-row" key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.detail}</span>
          </div>
          <span className="badge">{row.badge}</span>
        </div>
      ))}
    </div>
  );
}
