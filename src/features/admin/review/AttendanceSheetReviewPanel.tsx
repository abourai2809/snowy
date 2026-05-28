import { useEffect, useState } from "react";
import {
  calculateHours,
  type AttendanceEntry,
  type AttendanceSelfieCheck,
} from "../../../domain/attendance";
import type { LocationOption, StaffProfile } from "../../../domain/roles";
import {
  listAttendanceForMonth,
  listSelfieChecksForAttendanceIds,
} from "../../attendance/attendanceApi";
import { listLocations, listStaff } from "../staff/staffApi";

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

export function AttendanceSheetReviewPanel() {
  const [attendanceMonth, setAttendanceMonth] = useState(currentMonth);
  const [staffFilter, setStaffFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceEntry[]>([]);
  const [monthlySelfieChecks, setMonthlySelfieChecks] = useState<AttendanceSelfieCheck[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAttendanceReview() {
      const [monthlyAttendanceRows, staffRows, locationRows] = await Promise.all([
        listAttendanceForMonth(attendanceMonth),
        listStaff(),
        listLocations(),
      ]);
      const monthlySelfieRows = await listSelfieChecksForAttendanceIds(monthlyAttendanceRows.map((entry) => entry.id));

      setMonthlyAttendance(monthlyAttendanceRows);
      setMonthlySelfieChecks(monthlySelfieRows);
      setStaff(staffRows);
      setLocations(locationRows);
      setError(null);
    }

    void loadAttendanceReview().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load monthly attendance.");
    });
  }, [attendanceMonth]);

  const staffById = new Map(staff.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
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
    <section className="card attendance-review-card">
      <div className="card-title">Monthly attendance review</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
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
    const reviewLocationId = staff?.defaultLocationId ?? null;
    const location = reviewLocationId ? locationById.get(reviewLocationId) : undefined;
    const key = `${entry.workDate}|${entry.userId}`;
    const requiredHours = staff?.requiredHoursPerDay ?? 8;
    const existing = rows.get(key) ?? {
      id: key,
      date: entry.workDate,
      userId: entry.userId,
      staffName: staff?.name ?? entry.userId,
      locationId: reviewLocationId,
      locationName: location?.name ?? reviewLocationId ?? "No default",
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

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
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
