import { useEffect, useMemo, useState } from "react";
import { isCheckedOut, type AttendanceEntry } from "../../domain/attendance";
import type { LocationOption, StaffProfile } from "../../domain/roles";
import { isLabRole, isStoreRole, ROLE_LABELS } from "../../domain/roles";
import { useAuth } from "../auth/AuthProvider";
import { checkIn, checkOut, getActiveAttendance, listAttendanceForDate, listTodayAttendanceForUser } from "./attendanceApi";
import { listLocations, listStaff } from "../admin/staff/staffApi";

export function AttendancePage() {
  const { profile, refreshActiveAttendance } = useAuth();
  const [activeEntry, setActiveEntry] = useState<AttendanceEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<AttendanceEntry[]>([]);
  const [roster, setRoster] = useState<AttendanceEntry[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const staffById = useMemo(
    () => new Map(staff.map((member) => [member.id, member])),
    [staff],
  );
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );
  const workLocationOptions = useMemo(() => {
    if (!profile) return [];
    if (isStoreRole(profile.role)) {
      return locations.filter((location) => location.type === "store");
    }
    if (isLabRole(profile.role)) {
      return locations.filter((location) => location.type === "lab");
    }
    return locations;
  }, [locations, profile]);
  const latestEntry = todayEntries.at(-1) ?? null;
  const statusEntry = activeEntry ?? latestEntry;
  const todayHours = todayEntries.reduce((total, entry) => total + (entry.hours ?? 0), 0);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      if (!profile) {
        return;
      }

      setLoading(true);
      try {
        const [entry, entryRows, rosterRows, staffRows, locationRows] = await Promise.all([
          getActiveAttendance(profile.id),
          listTodayAttendanceForUser(profile.id),
          profile.role === "admin" ? listAttendanceForDate() : Promise.resolve([]),
          profile.role === "admin" ? listStaff() : Promise.resolve([]),
          listLocations(),
        ]);

        if (active) {
          setActiveEntry(entry);
          setTodayEntries(entryRows);
          setRoster(rosterRows);
          setStaff(staffRows);
          setLocations(locationRows);
          setSelectedLocationId(entry?.locationId ?? entryRows.at(-1)?.locationId ?? profile.defaultLocationId ?? "");
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

  useEffect(() => {
    if (activeEntry?.locationId) {
      setSelectedLocationId(activeEntry.locationId);
      return;
    }

    if (selectedLocationId && workLocationOptions.some((location) => location.id === selectedLocationId)) {
      return;
    }

    setSelectedLocationId(
      workLocationOptions.find((location) => location.id === profile?.defaultLocationId)?.id ??
        workLocationOptions[0]?.id ??
        "",
    );
  }, [activeEntry, profile?.defaultLocationId, selectedLocationId, workLocationOptions]);

  async function handleCheckIn() {
    if (!profile) {
      return;
    }

    try {
      const entry = await checkIn(profile, selectedLocationId);
      setActiveEntry(entry);
      setTodayEntries((current) => [...current, entry]);
      setError(null);
      await refreshActiveAttendance();
    } catch (checkInError) {
      setError(checkInError instanceof Error ? checkInError.message : "Unable to check in.");
    }
  }

  async function handleCheckOut() {
    if (!activeEntry) {
      return;
    }

    try {
      const entry = await checkOut(activeEntry);
      setActiveEntry(null);
      setTodayEntries((current) => current.map((item) => item.id === entry.id ? entry : item));
      setError(null);
      await refreshActiveAttendance();
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
            <strong>{activeEntry ? "Checked in" : latestEntry ? "Checked out" : "Not checked in"}</strong>
          </div>
          {statusEntry?.locationId ? (
            <div>
              <span className="label">Location</span>
              <strong>{locationById.get(statusEntry.locationId)?.name ?? statusEntry.locationId}</strong>
            </div>
          ) : null}
          {todayHours > 0 ? (
            <div>
              <span className="label">Hours</span>
              <strong>{Number(todayHours.toFixed(1))}</strong>
            </div>
          ) : null}
        </div>

        {!activeEntry ? (
          <label className="field">
            <span>{profile && isStoreRole(profile.role) ? "Work store" : "Work location"}</span>
            <select
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              required
            >
              <option value="">Select location</option>
              {workLocationOptions.map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={handleCheckIn}
            disabled={Boolean(activeEntry) || !selectedLocationId}
          >
            Check in
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleCheckOut}
            disabled={!activeEntry || isCheckedOut(activeEntry)}
          >
            Check out
          </button>
        </div>
      </section>

      {todayEntries.length > 0 ? (
        <section className="card">
          <div className="card-title">Today&apos;s shifts</div>
          <div className="list-stack" aria-label="Today's shifts">
            {todayEntries.map((entry, index) => (
              <div className="list-row" key={entry.id}>
                <div>
                  <strong>Shift {index + 1}</strong>
                  <span>
                    {formatTime(entry.checkInAt)}
                    {entry.checkOutAt ? ` - ${formatTime(entry.checkOutAt)}` : " - in progress"}
                    {entry.locationId ? ` / ${locationById.get(entry.locationId)?.name ?? entry.locationId}` : ""}
                  </span>
                </div>
                <span className="badge">{entry.checkOutAt ? `${entry.hours ?? 0}h` : "In"}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
                      <span>
                        {member ? ROLE_LABELS[member.role] : entry.userId}
                        {entry.locationId ? ` / ${locationById.get(entry.locationId)?.name ?? entry.locationId}` : ""}
                      </span>
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

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
