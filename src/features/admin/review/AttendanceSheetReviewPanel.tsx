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

type AttendanceCredit = "Full day" | "Half day" | "Absent" | "Day off" | "Needs review";

interface AttendanceReviewRow {
  id: string;
  date: string;
  userId: string;
  staffName: string;
  locationId: string | null;
  locationName: string;
  workedLocationNames: string;
  shiftCount: number;
  firstCheckInAt: string | null;
  lastCheckOutAt: string | null;
  totalHours: number;
  requiredHours: number;
  openShiftCount: number;
  selfiePassCount: number;
  selfiePendingCount: number;
  selfieNeedsReviewCount: number;
  selfieMissingCount: number;
  credit: AttendanceCredit;
  manualHours: boolean;
}

function currentDate(): string {
  return getTodayKey();
}

function currentMonth(): string {
  return currentDate().slice(0, 7);
}

export function AttendanceSheetReviewPanel() {
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [reviewMonth, setReviewMonth] = useState(currentMonth);
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

  const locationById = new Map(locations.map((location) => [location.id, location]));
  const selfieCheckByEntryId = new Map(selfieChecks.map((check) => [check.attendanceEntryId, check]));
  const attendanceReviewRows = applyManualHourOverrides(
    buildAttendanceReviewRows(attendanceEntries, selfieCheckByEntryId, staff, locationById, now, dateRange),
    manualHoursByRowId,
  ).filter((row) => {
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

  function updateReviewMonth(month: string) {
    if (!month) return;
    const range = monthDateRange(month);
    setReviewMonth(month);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function updateReviewDate(kind: "start" | "end", value: string) {
    const nextDate = value || currentDate();
    if (kind === "start") {
      setStartDate(nextDate);
    } else {
      setEndDate(nextDate);
    }
    setReviewMonth(nextDate.slice(0, 7));
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
          <span>Month</span>
          <input
            aria-label="Attendance month"
            type="month"
            value={reviewMonth}
            onChange={(event) => updateReviewMonth(event.target.value)}
          />
        </label>
        <label className="field compact-field">
          <span>Start date</span>
          <input
            aria-label="Attendance start date"
            type="date"
            value={startDate}
            onChange={(event) => updateReviewDate("start", event.target.value)}
          />
        </label>
        <label className="field compact-field">
          <span>End date</span>
          <input
            aria-label="Attendance end date"
            type="date"
            value={endDate}
            onChange={(event) => updateReviewDate("end", event.target.value)}
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
  staffRows: StaffProfile[],
  locationById: Map<string, LocationOption>,
  now: Date,
  dateRange: { startDate: string; endDate: string },
): AttendanceReviewRow[] {
  const rows = new Map<string, AttendanceReviewRow>();
  const today = getTodayKey(now);
  const entriesByUserDate = new Map<string, AttendanceEntry[]>();

  for (const entry of entries) {
    const key = `${entry.workDate}|${entry.userId}`;
    const existing = entriesByUserDate.get(key) ?? [];
    existing.push(entry);
    entriesByUserDate.set(key, existing);
  }

  const activeStaff = staffRows.filter((member) => member.active && member.signupStatus === "approved");
  for (const staff of activeStaff) {
    const reviewLocationId = staff.defaultLocationId ?? null;
    const location = reviewLocationId ? locationById.get(reviewLocationId) : undefined;

    for (const date of datesInRange(dateRange.startDate, dateRange.endDate)) {
      const key = `${date}|${staff.id}`;
      const dayEntries = [...(entriesByUserDate.get(key) ?? [])].sort((a, b) =>
        new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime(),
      );
      const row: AttendanceReviewRow = {
        id: key,
        date,
        userId: staff.id,
        staffName: staff.name,
        locationId: reviewLocationId,
        locationName: location?.name ?? reviewLocationId ?? "No default",
        workedLocationNames: formatWorkedLocations(dayEntries, locationById),
        shiftCount: 0,
        firstCheckInAt: dayEntries[0]?.checkInAt ?? null,
        lastCheckOutAt: null,
        totalHours: 0,
        requiredHours: staff.requiredHoursPerDay,
        openShiftCount: 0,
        selfiePassCount: 0,
        selfiePendingCount: 0,
        selfieNeedsReviewCount: 0,
        selfieMissingCount: 0,
        credit: "Absent",
        manualHours: false,
      };

      for (const entry of dayEntries) {
        row.shiftCount += 1;

        if (entry.checkOutAt) {
          row.totalHours += entry.hours ?? calculateHours(entry.checkInAt, entry.checkOutAt);
          if (!row.lastCheckOutAt || new Date(entry.checkOutAt).getTime() > new Date(row.lastCheckOutAt).getTime()) {
            row.lastCheckOutAt = entry.checkOutAt;
          }
        } else {
          row.openShiftCount += 1;
          if (entry.workDate === today) {
            row.totalHours += calculateHours(entry.checkInAt, now.toISOString());
          }
        }

        applySelfieStatus(row, entry, selfieCheckByEntryId.get(entry.id));
      }

      row.credit = classifyAttendanceCredit(row.totalHours, row.requiredHours, row.openShiftCount);
      rows.set(key, row);
    }
  }

  return applyDayOffPolicy([...rows.values()], activeStaff).sort((a, b) => {
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

function classifyAttendanceCredit(totalHours: number, requiredHours: number, openShiftCount: number): AttendanceCredit {
  if (openShiftCount > 0) return "Needs review";
  if (totalHours >= requiredHours) return "Full day";
  if (totalHours >= requiredHours / 2) return "Half day";
  if (totalHours > 0) return "Needs review";
  return "Absent";
}

function applyDayOffPolicy(rows: AttendanceReviewRow[], staffRows: StaffProfile[]): AttendanceReviewRow[] {
  const staffById = new Map(staffRows.map((staff): [string, StaffProfile] => [staff.id, staff]));
  const remainingDayOffsByUserId = new Map<string, number>();

  staffRows.forEach((staff) => {
    remainingDayOffsByUserId.set(staff.id, Math.max(0, Math.floor(staff.allowedHolidaysPerMonth + staff.bonusDaysBalance)));
  });

  return rows
    .sort((a, b) => {
      if (a.userId !== b.userId) return a.userId.localeCompare(b.userId);
      return a.date.localeCompare(b.date);
    })
    .map((row) => {
      if (row.credit !== "Absent" || row.shiftCount > 0 || !staffById.has(row.userId)) {
        return row;
      }

      const remaining = remainingDayOffsByUserId.get(row.userId) ?? 0;
      if (remaining <= 0) {
        return row;
      }

      remainingDayOffsByUserId.set(row.userId, remaining - 1);
      return { ...row, credit: "Day off" };
    });
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
    .filter((member) => member.active && member.signupStatus === "approved")
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

function monthDateRange(month: string): { startDate: string; endDate: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  const startDate = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  const today = currentDate();
  return {
    startDate,
    endDate: month === today.slice(0, 7) && today < monthEnd ? today : monthEnd,
  };
}

function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWorkedLocations(entries: AttendanceEntry[], locationById: Map<string, LocationOption>): string {
  const names = [
    ...new Set(
      entries.map((entry) => {
        if (!entry.locationId) return "No location";
        return locationById.get(entry.locationId)?.name ?? entry.locationId;
      }),
    ),
  ];

  return names.length === 0 ? "-" : names.join(", ");
}

function buildCsvHref(rows: AttendanceReviewRow[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildAttendanceCsv(rows))}`;
}

function buildAttendanceCsv(rows: AttendanceReviewRow[]): string {
  const header = [
    "Date",
    "Employee",
    "Review location",
    "Worked at",
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
    row.workedLocationNames,
    String(row.shiftCount),
    row.firstCheckInAt ? formatTime(row.firstCheckInAt) : "-",
    row.lastCheckOutAt ? formatTime(row.lastCheckOutAt) : "-",
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
        <td>${escapeHtml(row.workedLocationNames)}</td>
        <td>${row.shiftCount}</td>
        <td>${escapeHtml(row.firstCheckInAt ? formatTime(row.firstCheckInAt) : "-")}</td>
        <td>${escapeHtml(row.lastCheckOutAt ? formatTime(row.lastCheckOutAt) : "-")}</td>
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
          <th>Worked at</th>
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
  const dayOffs = rows.filter((row) => row.credit === "Day off").length;
  const absentDays = rows.filter((row) => row.credit === "Absent").length;
  const needsReview = rows.filter((row) => row.credit === "Needs review").length;

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
        <span>Day off</span>
        <strong>{dayOffs}</strong>
      </div>
      <div>
        <span>Absent</span>
        <strong>{absentDays}</strong>
      </div>
      <div>
        <span>Review</span>
        <strong>{needsReview}</strong>
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
    return <p className="muted-copy">No attendance review rows match this date range and filter.</p>;
  }

  return (
    <div className="review-table-wrap">
      <table className="review-table" aria-label="Attendance review">
        <thead>
          <tr>
            <th>Date</th>
            <th>Employee</th>
            <th>Location</th>
            <th>Worked at</th>
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
              <td>{row.workedLocationNames}</td>
              <td>{row.shiftCount}</td>
              <td>{row.firstCheckInAt ? formatTime(row.firstCheckInAt) : "-"}</td>
              <td>{row.lastCheckOutAt ? formatTime(row.lastCheckOutAt) : "-"}</td>
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
                {row.openShiftCount > 0 ? <small>Open shift</small> : null}
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
