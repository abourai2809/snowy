import { useEffect, useMemo, useState } from "react";
import { isCheckedOut, type AttendanceEntry } from "../../domain/attendance";
import type { LocationOption, StaffProfile } from "../../domain/roles";
import { isLabRole, isStoreRole, ROLE_LABELS } from "../../domain/roles";
import { useAuth } from "../auth/AuthProvider";
import {
  checkIn,
  checkOut,
  getActiveAttendance,
  listAttendanceForDate,
  listSelfieChecksForAttendanceIds,
  listTodayAttendanceForUser,
  switchAttendanceLocation,
} from "./attendanceApi";
import type { AttendanceSelfieCheck } from "../../domain/attendance";
import { collectVerifiedAttendanceLocation } from "./locationEvidence";
import { listLocations, listStaff } from "../admin/staff/staffApi";
import { getOperationsSettings, type OperationsSettings } from "../settings/operationsSettingsApi";

export function AttendancePage() {
  const { profile, refreshActiveAttendance } = useAuth();
  const [activeEntry, setActiveEntry] = useState<AttendanceEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<AttendanceEntry[]>([]);
  const [roster, setRoster] = useState<AttendanceEntry[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [selfieChecks, setSelfieChecks] = useState<AttendanceSelfieCheck[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [settings, setSettings] = useState<OperationsSettings | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieInputKey, setSelfieInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState<"check-in" | "check-out" | "switch-location" | null>(null);

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
  const selectedLocation = selectedLocationId ? locationById.get(selectedLocationId) ?? null : null;
  const locationCheckInRequired = settings?.locationCheckInRequired ?? true;
  const selfieCheckByEntryId = useMemo(() => {
    const checks = new Map<string, AttendanceSelfieCheck>();
    selfieChecks.forEach((check) => {
      checks.set(check.attendanceEntryId, check);
    });
    return checks;
  }, [selfieChecks]);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      if (!profile) {
        return;
      }

      setLoading(true);
      try {
        const [entry, entryRows, rosterRows, staffRows, locationRows, operationsSettings] = await Promise.all([
          getActiveAttendance(profile.id),
          listTodayAttendanceForUser(profile.id),
          profile.role === "admin" ? listAttendanceForDate() : Promise.resolve([]),
          profile.role === "admin" ? listStaff() : Promise.resolve([]),
          listLocations(),
          getOperationsSettings(),
        ]);
        const selfieRows = await listSelfieChecksForAttendanceIds(
          [...entryRows, ...rosterRows].map((attendanceEntry) => attendanceEntry.id),
        );

        if (active) {
          setActiveEntry(entry);
          setTodayEntries(entryRows);
          setRoster(rosterRows);
          setStaff(staffRows);
          setSelfieChecks(selfieRows);
          setLocations(locationRows);
          setSettings(operationsSettings);
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
    if (activeEntry?.locationId && (!selectedLocationId || !workLocationOptions.some((location) => location.id === selectedLocationId))) {
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
      if (!selectedLocation) {
        throw new Error("Work location is required.");
      }
      if (!selfieFile) {
        throw new Error("Check-in selfie is required.");
      }

      setSubmittingAction("check-in");
      const locationEvidence = locationCheckInRequired
        ? await collectVerifiedAttendanceLocation(selectedLocation)
        : null;
      const entry = await checkIn(profile, selectedLocationId, new Date(), locationEvidence, selfieFile);
      const checks = await listSelfieChecksForAttendanceIds([entry.id]);
      setActiveEntry(entry);
      setTodayEntries((current) => [...current, entry]);
      setSelfieChecks((current) => [...current.filter((check) => check.attendanceEntryId !== entry.id), ...checks]);
      setSelfieFile(null);
      setSelfieInputKey((current) => current + 1);
      setError(null);
      await refreshActiveAttendance();
    } catch (checkInError) {
      setError(checkInError instanceof Error ? checkInError.message : "Unable to check in.");
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleCheckOut() {
    if (!activeEntry) {
      return;
    }

    try {
      const activeLocation = activeEntry.locationId ? locationById.get(activeEntry.locationId) ?? null : null;
      if (!activeLocation) {
        throw new Error("Checked-in location could not be found.");
      }

      setSubmittingAction("check-out");
      const locationEvidence = locationCheckInRequired
        ? await collectVerifiedAttendanceLocation(activeLocation)
        : null;
      const entry = await checkOut(activeEntry, new Date(), locationEvidence);
      setActiveEntry(null);
      setTodayEntries((current) => current.map((item) => item.id === entry.id ? entry : item));
      setError(null);
      await refreshActiveAttendance();
    } catch (checkOutError) {
      setError(checkOutError instanceof Error ? checkOutError.message : "Unable to check out.");
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleSwitchLocation() {
    if (!activeEntry) {
      return;
    }

    try {
      if (!selectedLocation) {
        throw new Error("Work location is required.");
      }

      setSubmittingAction("switch-location");
      if (locationCheckInRequired) {
        await collectVerifiedAttendanceLocation(selectedLocation);
      }
      const entry = await switchAttendanceLocation(activeEntry, selectedLocationId, new Date());
      setActiveEntry(entry);
      setTodayEntries((current) => current.map((item) => item.id === entry.id ? entry : item));
      setError(null);
      await refreshActiveAttendance();
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Unable to switch location.");
    } finally {
      setSubmittingAction(null);
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
        {submittingAction && locationCheckInRequired ? (
          <p className="muted-copy">
            Checking location before{" "}
            {submittingAction === "check-in"
              ? "check in"
              : submittingAction === "check-out"
                ? "check out"
                : "switching location"}
            ...
          </p>
        ) : null}
        {!locationCheckInRequired ? (
          <p className="muted-copy">Location verification is off. Choose the work location before marking attendance.</p>
        ) : null}

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

        {!activeEntry ? (
          <>
            <label className="field">
              <span>Check-in selfie</span>
              <input
                key={selfieInputKey}
                aria-label="Check-in selfie"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)}
                required
              />
              <small>Apron, headwear, gloved thumbs-up</small>
            </label>
          </>
        ) : null}

        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={handleCheckIn}
            disabled={Boolean(activeEntry) || !selectedLocationId || !selfieFile || Boolean(submittingAction)}
          >
            {submittingAction === "check-in" ? "Checking..." : "Check in"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleSwitchLocation}
            disabled={
              !activeEntry ||
              !selectedLocationId ||
              selectedLocationId === activeEntry.locationId ||
              Boolean(submittingAction)
            }
          >
            {submittingAction === "switch-location" ? "Checking..." : "Switch location"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleCheckOut}
            disabled={!activeEntry || isCheckedOut(activeEntry) || Boolean(submittingAction)}
          >
            {submittingAction === "check-out" ? "Checking..." : "Check out"}
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
                  {entry.checkInLocation ? (
                    <span>{formatLocationEvidence("In", entry.checkInLocation.distanceM, entry.checkInLocation.accuracyM)}</span>
                  ) : null}
                  {entry.checkOutLocation ? (
                    <span>{formatLocationEvidence("Out", entry.checkOutLocation.distanceM, entry.checkOutLocation.accuracyM)}</span>
                  ) : null}
                  {entry.selfieInUrl ? (
                    <span>{formatSelfieCheck(selfieCheckByEntryId.get(entry.id))}</span>
                  ) : null}
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
                      {entry.checkInLocation ? (
                        <span>{formatLocationEvidence("In", entry.checkInLocation.distanceM, entry.checkInLocation.accuracyM)}</span>
                      ) : null}
                      {entry.checkOutLocation ? (
                        <span>{formatLocationEvidence("Out", entry.checkOutLocation.distanceM, entry.checkOutLocation.accuracyM)}</span>
                      ) : null}
                      {entry.selfieInUrl ? (
                        <span>{formatSelfieCheck(selfieCheckByEntryId.get(entry.id))}</span>
                      ) : null}
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

function formatLocationEvidence(label: string, distanceM: number | null, accuracyM: number | null): string {
  const distance = distanceM === null ? "distance n/a" : `${Math.round(distanceM)}m away`;
  const accuracy = accuracyM === null ? "accuracy n/a" : `accuracy ${Math.round(accuracyM)}m`;
  return `${label} location: ${distance}, ${accuracy}`;
}

function formatSelfieCheck(check: AttendanceSelfieCheck | undefined): string {
  if (!check) {
    return "Selfie check: queued";
  }

  if (check.status === "queued" || check.status === "running") {
    return `Selfie check: ${check.status}`;
  }

  if (check.status === "failed") {
    return "Selfie check: needs review";
  }

  const details = [
    `apron ${check.apronStatus ?? "unclear"}`,
    `headwear ${check.headwearStatus ?? "unclear"}`,
    `glove ${check.gloveThumbsUpStatus ?? "unclear"}`,
    check.confidence === null ? null : `confidence ${Math.round(check.confidence * 100)}%`,
  ].filter(Boolean);
  return `Selfie check: ${check.overallStatus?.replace("_", " ") ?? "needs review"} / ${details.join(" / ")}`;
}
