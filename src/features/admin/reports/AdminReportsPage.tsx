import { useEffect, useState } from "react";
import type { AttendanceEntry, AttendanceSelfieCheck } from "../../../domain/attendance";
import type { Dispatch } from "../../../domain/dispatches";
import type { DeepFreezerCountWithItems } from "../../../domain/inventory";
import type { StaffProfile } from "../../../domain/roles";
import type { InventoryCountWithItems } from "../../../domain/supplies";
import { listStaff } from "../staff/staffApi";
import { listAttendanceForDate, listSelfieChecksForAttendanceIds } from "../../attendance/attendanceApi";
import { listInventoryCounts } from "../../inventory/inventoryApi";
import { listLabDispatches } from "../../lab/labApi";
import { listDeepFreezerCounts, MORNING_VERIFICATION_TOLERANCE_KG } from "../../store/deepFreezerApi";
import { listEmptyPanCountsByStore, listEodGelatoCounts, type EodCountWithItems, type StoreEmptyPanCount } from "../../store/storeApi";
import { CorrectionsPage } from "../corrections/CorrectionsPage";
import { EodGelatoCorrectionsPage } from "../corrections/EodGelatoCorrectionsPage";
import { AttendanceSelfieReviewPanel, formatSelfieBadge, formatSelfieDetail } from "../review/AttendanceSelfieReviewPanel";
import { AdminDeepFreezerTools } from "./AdminDeepFreezerTools";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminReportsPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [gelatoCounts, setGelatoCounts] = useState<EodCountWithItems[]>([]);
  const [morningChecks, setMorningChecks] = useState<DeepFreezerCountWithItems[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCountWithItems[]>([]);
  const [emptyPanCounts, setEmptyPanCounts] = useState<StoreEmptyPanCount[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [selfieChecks, setSelfieChecks] = useState<AttendanceSelfieCheck[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
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
        staffRows,
      ] = await Promise.all([
        listLabDispatches(),
        listEodGelatoCounts(),
        listDeepFreezerCounts("morning"),
        listInventoryCounts(),
        listEmptyPanCountsByStore(),
        listAttendanceForDate(todayDate()),
        listStaff(),
      ]);
      const selfieRows = await listSelfieChecksForAttendanceIds(attendanceRows.map((entry) => entry.id));

      setDispatches(dispatchRows);
      setGelatoCounts(gelatoRows);
      setMorningChecks(morningRows);
      setInventoryCounts(inventoryRows);
      setEmptyPanCounts(emptyPanRows);
      setAttendance(attendanceRows);
      setSelfieChecks(selfieRows);
      setStaff(staffRows);
    }

    void loadReports().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load reports."));
  }, []);

  const staffById = new Map(staff.map((item) => [item.id, item]));
  const selfieCheckByEntryId = new Map(selfieChecks.map((check) => [check.attendanceEntryId, check]));

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

      <AttendanceSelfieReviewPanel title="Recent attendance selfies" />

      <AdminDeepFreezerTools />
      <EodGelatoCorrectionsPage />
      <CorrectionsPage />
    </div>
  );
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
