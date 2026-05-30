import { useEffect, useState } from "react";
import {
  calculateHours,
  getTodayKey,
  type AttendanceEntry,
  type AttendanceSelfieCheck,
} from "../../../domain/attendance";
import type { LocationOption, StaffProfile } from "../../../domain/roles";
import { calculateSalaryRow, daysInMonthForDate, type SalaryCalculationRow } from "../../../domain/salary";
import {
  listAttendanceForDateRange,
  listSelfieChecksForAttendanceIds,
} from "../../attendance/attendanceApi";
import { listLocations, listStaff } from "../staff/staffApi";

function currentDate(): string {
  return getTodayKey();
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
  manualHours: boolean;
}

export function AttendanceSheetReviewPanel() {
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [staffFilter, setStaffFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [selfieChecks, setSelfieChecks] = useState<AttendanceSelfieCheck[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [manualHoursEnabled, setManualHoursEnabled] = useState(false);
  const [manualHoursByRowId, setManualHoursByRowId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const dateRange = normalizeDateRange(startDate, endDate);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function loadAttendanceReview() {
      const [attendanceRows, staffRows, locationRows] = await Promise.all([
        listAttendanceForDateRange(dateRange.startDate, dateRange.endDate),
        listStaff(),
        listLocations(),
      ]);
      const selfieRows = await listSelfieChecksForAttendanceIds(attendanceRows.map((entry) => entry.id));

      setAttendanceEntries(attendanceRows);
      setSelfieChecks(selfieRows);
      setStaff(staffRows);
      setLocations(locationRows);
      setError(null);
    }

    void loadAttendanceReview().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load attendance review.");
    });
  }, [dateRange.endDate, dateRange.startDate]);

  const staffById = new Map(staff.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const selfieCheckByEntryId = new Map(selfieChecks.map((check) => [check.attendanceEntryId, check]));
  const attendanceReviewRows = applyManualHourOverrides(buildAttendanceReviewRows(
    attendanceEntries,
    selfieCheckByEntryId,
    staffById,
    locationById,
    now,
  ), manualHoursByRowId).filter((row) => {
    if (staffFilter && row.userId !== staffFilter) return false;
    if (locationFilter && row.locationId !== locationFilter) return false;
    return true;
  });
  const csvHref = buildCsvHref(attendanceReviewRows);
  const exportFileName = `attendance-${dateRange.startDate}-to-${dateRange.endDate}.csv`;

  function enableManualHours() {
    if (manualHoursEnabled) {
      setManualHoursEnabled(false);
      return;
    }

    const confirmed = window.confirm(
      "Manual hour changes affect the review table and salary PDF for this session only. Continue?",
    );
    if (confirmed) {
      setManualHoursEnabled(true);
    }
  }

  function updateManualHours(row: AttendanceReviewRow, value: string) {
    setManualHoursByRowId((current) => {
      const next = { ...current };
      if (value === "") {
        delete next[row.id];
      } else {
        next[row.id] = value;
      }
      return next;
    });
  }

  function generateSalaryPdf() {
    const salaryRows = buildSalaryCalculationRows(attendanceReviewRows, staff, locationById, {
      staffFilter,
      locationFilter,
      daysInMonth: daysInMonthForDate(dateRange.startDate),
    });
    printSalarySheet(salaryRows, dateRange.startDate, dateRange.endDate);
  }

  return (
    <section className="card attendance-review-card">
      <div className="card-title">Attendance review</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      <div className="review-controls">
        <label className="field compact-field">
          <span>Start date</span>
          <input
            aria-label="Attendance start date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value || currentDate())}
          />
        </label>
        <label className="field compact-field">
          <span>End date</span>
          <input
            aria-label="Attendance end date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value || currentDate())}
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
        <div className="review-actions" aria-label="Attendance export actions">
          <a className="secondary-button export-link" href={csvHref} download={exportFileName}>
            Export CSV
          </a>
          <button
            className="secondary-button"
            type="button"
            onClick={() => printAttendanceSheet(attendanceReviewRows, dateRange.startDate, dateRange.endDate)}
          >
            Export PDF
          </button>
          <button className="secondary-button" type="button" onClick={generateSalaryPdf}>
            Calculate salary
          </button>
          <button className="secondary-button" type="button" onClick={enableManualHours}>
            {manualHoursEnabled ? "Done editing hours" : "Edit hours"}
          </button>
        </div>
      </div>
      <AttendanceReviewSummary rows={attendanceReviewRows} />
      <AttendanceReviewTable
        rows={attendanceReviewRows}
        manualHoursEnabled={manualHoursEnabled}
        manualHoursByRowId={manualHoursByRowId}
        onManualHoursChange={updateManualHours}
      />
    </section>
  );
}

function buildAttendanceReviewRows(
  entries: AttendanceEntry[],
  selfieCheckByEntryId: Map<string, AttendanceSelfieCheck>,
  staffById: Map<string, StaffProfile>,
  locationById: Map<string, LocationOption>,
  now: Date,
): AttendanceReviewRow[] {
  const rows = new Map<string, AttendanceReviewRow>();
  const today = getTodayKey(now);

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
      manualHours: false,
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
      if (entry.workDate === today) {
        existing.totalHours += calculateHours(entry.checkInAt, now.toISOString());
      }
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

function applyManualHourOverrides(
  rows: AttendanceReviewRow[],
  manualHoursByRowId: Record<string, string>,
): AttendanceReviewRow[] {
  return rows.map((row) => {
    const manualHours = manualHoursByRowId[row.id];
    if (manualHours === undefined || manualHours === "") {
      return row;
    }

    const totalHours = Number(manualHours);
    if (!Number.isFinite(totalHours) || totalHours < 0) {
      return row;
    }

    return {
      ...row,
      totalHours,
      manualHours: true,
      credit: classifyAttendanceCredit(totalHours, row.requiredHours, row.openShiftCount),
    };
  });
}

function buildSalaryCalculationRows(
  reviewRows: AttendanceReviewRow[],
  staff: StaffProfile[],
  locationById: Map<string, LocationOption>,
  options: {
    staffFilter: string;
    locationFilter: string;
    daysInMonth: number;
  },
): SalaryCalculationRow[] {
  const workedDaysByUserId = new Map<string, number>();
  for (const row of reviewRows) {
    workedDaysByUserId.set(
      row.userId,
      (workedDaysByUserId.get(row.userId) ?? 0) + attendanceDayCredit(row.totalHours, row.requiredHours),
    );
  }

  return staff
    .filter((member) => member.active)
    .filter((member) => !options.staffFilter || member.id === options.staffFilter)
    .filter((member) => !options.locationFilter || member.defaultLocationId === options.locationFilter)
    .map((member) => {
      const locationName = member.defaultLocationId
        ? locationById.get(member.defaultLocationId)?.name ?? member.defaultLocationId
        : "No default";

      return calculateSalaryRow({
        staffName: member.name,
        locationName,
        salaryAmount: member.salaryAmount,
        salaryType: member.salaryType,
        workedDays: workedDaysByUserId.get(member.id) ?? 0,
        daysInMonth: options.daysInMonth,
      });
    })
    .sort((a, b) => {
      if (a.locationName !== b.locationName) return a.locationName.localeCompare(b.locationName);
      return a.staffName.localeCompare(b.staffName);
    });
}

function attendanceDayCredit(totalHours: number, requiredHours: number): number {
  if (totalHours >= requiredHours) return 1;
  if (totalHours >= requiredHours / 2) return 0.5;
  return 0;
}

function normalizeDateRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
}

function buildCsvHref(rows: AttendanceReviewRow[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildAttendanceCsv(rows))}`;
}

function buildAttendanceCsv(rows: AttendanceReviewRow[]): string {
  const header = [
    "Date",
    "Employee",
    "Review location",
    "Shifts",
    "First check-in",
    "Last checkout",
    "Hours",
    "Credit",
    "Selfie",
  ];
  const body = rows.map((row) => [
    row.date,
    row.staffName,
    row.locationName,
    String(row.shiftCount),
    formatTime(row.firstCheckInAt),
    row.lastCheckOutAt ? formatTime(row.lastCheckOutAt) : "Open",
    formatHours(row.totalHours),
    row.credit,
    formatReviewSelfieStatus(row),
  ]);

  return [header, ...body].map((line) => line.map(formatCsvValue).join(",")).join("\n");
}

function printAttendanceSheet(rows: AttendanceReviewRow[], startDate: string, endDate: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(buildAttendancePrintHtml(rows, startDate, endDate));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function printSalarySheet(rows: SalaryCalculationRow[], startDate: string, endDate: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(buildSalaryPrintHtml(rows, startDate, endDate));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function buildAttendancePrintHtml(rows: AttendanceReviewRow[], startDate: string, endDate: string): string {
  const title = `Attendance ${startDate} to ${endDate}`;
  const tableRows = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.staffName)}</td>
        <td>${escapeHtml(row.locationName)}</td>
        <td>${row.shiftCount}</td>
        <td>${escapeHtml(formatTime(row.firstCheckInAt))}</td>
        <td>${escapeHtml(row.lastCheckOutAt ? formatTime(row.lastCheckOutAt) : "Open")}</td>
        <td>${escapeHtml(formatHours(row.totalHours))}</td>
        <td>${escapeHtml(row.credit)}</td>
        <td>${escapeHtml(formatReviewSelfieStatus(row))}</td>
      </tr>
    `).join("");

  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2933; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p { margin: 0 0 16px; color: #52606d; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d9e2ec; padding: 8px; text-align: left; }
      th { background: #f0f4f8; text-transform: uppercase; font-size: 10px; }
    </style>
  </head>
  <body>
    <h1>Attendance sheet</h1>
    <p>${escapeHtml(startDate)} to ${escapeHtml(endDate)}</p>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Employee</th>
          <th>Review location</th>
          <th>Shifts</th>
          <th>First check-in</th>
          <th>Last checkout</th>
          <th>Hours</th>
          <th>Credit</th>
          <th>Selfie</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body>
</html>`;
}

function buildSalaryPrintHtml(rows: SalaryCalculationRow[], startDate: string, endDate: string): string {
  const daysInMonth = daysInMonthForDate(startDate);
  const salaryRows = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.staffName)}</td>
        <td>${escapeHtml(row.locationName)}</td>
        <td>${escapeHtml(row.salaryLabel)}</td>
        <td>${row.monthlySalary === null ? "-" : escapeHtml(formatMoney(row.monthlySalary))}</td>
        <td>${escapeHtml(formatHours(row.workedDays))}</td>
        <td>${escapeHtml(formatHours(row.requiredDays))}</td>
        <td>${escapeHtml(formatHours(row.extraDays))}</td>
        <td>${escapeHtml(formatMoney(row.dailyRate))}</td>
        <td>${escapeHtml(formatMoney(row.payableSalary))}</td>
        <td>${escapeHtml(row.calculation)}</td>
      </tr>
    `).join("");

  return `<!doctype html>
<html>
  <head>
    <title>Salary ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #1f2933; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p { margin: 0 0 14px; color: #52606d; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #d9e2ec; padding: 7px; text-align: left; vertical-align: top; }
      th { background: #f0f4f8; text-transform: uppercase; font-size: 9px; }
    </style>
  </head>
  <body>
    <h1>Salary calculation</h1>
    <p>Attendance period: ${escapeHtml(startDate)} to ${escapeHtml(endDate)}. Calendar days in salary month: ${daysInMonth}. Required days: ${daysInMonth} - 4 = ${daysInMonth - 4}.</p>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Review location</th>
          <th>Salary type</th>
          <th>Monthly salary</th>
          <th>Worked days</th>
          <th>Required days</th>
          <th>Extra days</th>
          <th>Daily rate</th>
          <th>Payable</th>
          <th>Calculation</th>
        </tr>
      </thead>
      <tbody>${salaryRows}</tbody>
    </table>
  </body>
</html>`;
}

function formatCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function AttendanceReviewTable({
  rows,
  manualHoursEnabled,
  manualHoursByRowId,
  onManualHoursChange,
}: {
  rows: AttendanceReviewRow[];
  manualHoursEnabled: boolean;
  manualHoursByRowId: Record<string, string>;
  onManualHoursChange: (row: AttendanceReviewRow, value: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="muted-copy">No attendance entries match this date range and filter.</p>;
  }

  return (
    <div className="review-table-wrap">
      <table className="review-table" aria-label="Attendance review">
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
              <td>
                {manualHoursEnabled ? (
                  <label className="manual-hours-field">
                    <span>Hours</span>
                    <input
                      aria-label={`Manual hours ${row.staffName} ${row.date}`}
                      type="number"
                      min="0"
                      max="24"
                      step="0.1"
                      value={manualHoursByRowId[row.id] ?? formatHours(row.totalHours)}
                      onChange={(event) => onManualHoursChange(row, event.target.value)}
                    />
                  </label>
                ) : (
                  formatHours(row.totalHours)
                )}
                {row.openShiftCount > 0 ? <small>Running</small> : null}
                {row.manualHours ? <small>Manual</small> : null}
              </td>
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

function formatMoney(value: number): string {
  return value.toLocaleString([], {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatReviewSelfieStatus(row: AttendanceReviewRow): string {
  if (row.selfieNeedsReviewCount > 0) return `${row.selfieNeedsReviewCount} needs review`;
  if (row.selfiePendingCount > 0) return `${row.selfiePendingCount} pending`;
  if (row.selfieMissingCount > 0) return `${row.selfieMissingCount} missing`;
  if (row.selfiePassCount > 0) return "Pass";
  return "No selfie";
}
