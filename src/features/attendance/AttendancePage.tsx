import { useEffect, useMemo, useState } from "react";
import { isCheckedOut, type AttendanceEntry } from "../../domain/attendance";
import type { StaffProfile } from "../../domain/roles";
import { ROLE_LABELS } from "../../domain/roles";
import { useAuth } from "../auth/AuthProvider";
import { checkIn, checkOut, getTodayAttendance, listAttendanceForDate } from "./attendanceApi";
import { listStaff } from "../admin/staff/staffApi";

export function AttendancePage() {
  const { profile } = useAuth();
  const [todayEntry, setTodayEntry] = useState<AttendanceEntry | null>(null);
  const [roster, setRoster] = useState<AttendanceEntry[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const staffById = useMemo(
    () => new Map(staff.map((member) => [member.id, member])),
    [staff],
  );

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      if (!profile) {
        return;
      }

      setLoading(true);
      try {
        const [entry, rosterRows, staffRows] = await Promise.all([
          getTodayAttendance(profile.id),
          profile.role === "admin" ? listAttendanceForDate() : Promise.resolve([]),
          profile.role === "admin" ? listStaff() : Promise.resolve([]),
        ]);

        if (active) {
          setTodayEntry(entry);
          setRoster(rosterRows);
          setStaff(staffRows);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load attendance.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttendance();

    return () => {
      active = false;
    };
  }, [profile]);

  async function handleCheckIn() {
    if (!profile) {
      return;
    }

    try {
      const entry = await checkIn(profile);
      setTodayEntry(entry);
      setError(null);
    } catch (checkInError) {
      setError(checkInError instanceof Error ? checkInError.message : "Unable to check in.");
    }
  }

  async function handleCheckOut() {
    if (!todayEntry) {
      return;
    }

    try {
      const entry = await checkOut(todayEntry);
      setTodayEntry(entry);
      setError(null);
    } catch (checkOutError) {
      setError(checkOutError instanceof Error ? checkOutError.message : "Unable to check out.");
    }
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="card-title">Today</div>
        {loading ? <p className="muted-copy">Loading attendance...</p> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="attendance-state">
          <div>
            <span className="label">Status</span>
            <strong>{todayEntry ? (isCheckedOut(todayEntry) ? "Checked out" : "Checked in") : "Not checked in"}</strong>
          </div>
          {todayEntry?.hours ? (
            <div>
              <span className="label">Hours</span>
              <strong>{todayEntry.hours}</strong>
            </div>
          ) : null}
        </div>

        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={handleCheckIn}
            disabled={Boolean(todayEntry)}
          >
            Check in
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleCheckOut}
            disabled={!todayEntry || isCheckedOut(todayEntry)}
          >
            Check out
          </button>
        </div>
      </section>

      {profile.role === "admin" ? (
        <section className="card">
          <div className="card-title">Today roster</div>
          {roster.length === 0 ? (
            <p className="muted-copy">No staff have checked in yet.</p>
          ) : (
            <div className="list-stack" aria-label="Attendance roster">
              {roster.map((entry) => {
                const member = staffById.get(entry.userId);
                return (
                  <div className="list-row" key={entry.id}>
                    <div>
                      <strong>{member?.name ?? "Unknown staff"}</strong>
                      <span>{member ? ROLE_LABELS[member.role] : entry.userId}</span>
                    </div>
                    <span className="badge">{entry.checkOutAt ? "Out" : "In"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
