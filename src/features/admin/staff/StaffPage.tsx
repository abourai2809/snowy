import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { APP_ROLES, ROLE_LABELS, type AppRole, type LocationOption, type SalaryType, type StaffProfile } from "../../../domain/roles";
import {
  approveStaffSignup,
  listLocations,
  listStaff,
  rejectStaffSignup,
  saveStaff,
  setStaffActive,
  updateHolidaySettings,
  type StaffInput,
} from "./staffApi";
import {
  getOperationsSettings,
  updateLocationCheckInRequired,
  type OperationsSettings,
} from "../../settings/operationsSettingsApi";

const emptyForm: StaffInput = {
  name: "",
  phone: "",
  role: "store_staff",
  defaultLocationId: "rajpur",
  salaryAmount: null,
  salaryType: "daily",
  requiredHoursPerDay: 8,
  allowedHolidaysPerMonth: 0,
  bonusDaysBalance: 0,
};

export function StaffPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [settings, setSettings] = useState<OperationsSettings | null>(null);
  const [locationCheckInRequired, setLocationCheckInRequired] = useState(true);
  const [form, setForm] = useState<StaffInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [staffRows, locationRows, settingsRow] = await Promise.all([
        listStaff(),
        listLocations(),
        getOperationsSettings(),
      ]);
      setStaff(staffRows);
      setLocations(locationRows);
      setSettings(settingsRow);
      setLocationCheckInRequired(settingsRow.locationCheckInRequired);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function updateForm<K extends keyof StaffInput>(key: K, value: StaffInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveStaff(form);
      setForm(emptyForm);
      setMessage("Staff member added.");
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save staff.");
    }
  }

  async function handleLocationSettingSave() {
    try {
      const updated = await updateLocationCheckInRequired(locationCheckInRequired);
      setSettings(updated);
      setLocationCheckInRequired(updated.locationCheckInRequired);
      setMessage("Attendance location setting saved.");
      setError(null);
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Unable to update attendance setting.");
    }
  }

  async function handleHolidaySave(member: StaffProfile) {
    try {
      await updateHolidaySettings(
        member.id,
        member.allowedHolidaysPerMonth,
        member.bonusDaysBalance,
        member.requiredHoursPerDay,
      );
      await refresh();
    } catch (holidayError) {
      setError(holidayError instanceof Error ? holidayError.message : "Unable to update attendance rules.");
    }
  }

  async function handleActiveChange(member: StaffProfile, active: boolean) {
    try {
      await setStaffActive(member.id, active);
      await refresh();
    } catch (activeError) {
      setError(activeError instanceof Error ? activeError.message : "Unable to update staff status.");
    }
  }

  function updateStaffRow(id: string, patch: Partial<StaffProfile>) {
    setStaff((current) =>
      current.map((member) => (member.id === id ? { ...member, ...patch } : member)),
    );
  }

  async function handleSignupApproval(member: StaffProfile) {
    try {
      await approveStaffSignup(member.id);
      await refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to approve signup.");
    }
  }

  async function handleSignupRejection(member: StaffProfile) {
    try {
      await rejectStaffSignup(member.id);
      await refresh();
    } catch (rejectionError) {
      setError(rejectionError instanceof Error ? rejectionError.message : "Unable to reject signup.");
    }
  }

  function locationName(locationId: string | null) {
    if (!locationId) return "No default";
    return locations.find((location) => location.id === locationId)?.name ?? locationId;
  }

  function statusLabel(member: StaffProfile) {
    if (member.signupStatus === "pending") return "Pending approval";
    if (member.signupStatus === "rejected") return "Rejected";
    return member.active ? "Active" : "Disabled";
  }

  const pendingSignups = staff.filter((member) => member.signupStatus === "pending");
  const roster = staff.filter((member) => member.signupStatus !== "pending");

  return (
    <div className="page-stack">
      <section className="card">
        <div className="card-title">Attendance controls</div>
        {message ? <div className="alert alert-success">{message}</div> : null}
        <div className="setting-row">
          <div>
            <strong>Location-based check-in</strong>
            <span>Require phone location verification for check-in and check-out.</span>
          </div>
          <label className="switch-field">
            <input
              aria-label="Location-based check-in"
              type="checkbox"
              checked={locationCheckInRequired}
              onChange={(event) => setLocationCheckInRequired(event.target.checked)}
            />
            <span>{locationCheckInRequired ? "On" : "Off"}</span>
          </label>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={settings?.locationCheckInRequired === locationCheckInRequired}
          onClick={handleLocationSettingSave}
        >
          Save attendance setting
        </button>
      </section>

      <section className="card">
        <div className="card-title">Add staff</div>
        <form className="staff-form" aria-label="Add staff form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={(event) => updateForm("role", event.target.value as AppRole)}>
              {APP_ROLES.filter((role) => role !== "admin").map((role) => (
                <option value={role} key={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Location</span>
            <select
              value={form.defaultLocationId ?? ""}
              onChange={(event) => updateForm("defaultLocationId", event.target.value || null)}
            >
              <option value="">No default</option>
              {locations.map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Salary type</span>
            <select
              value={form.salaryType ?? ""}
              onChange={(event) => updateForm("salaryType", (event.target.value || null) as SalaryType | null)}
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="field">
            <span>Salary amount</span>
            <input
              type="number"
              value={form.salaryAmount ?? ""}
              onChange={(event) =>
                updateForm("salaryAmount", event.target.value ? Number(event.target.value) : null)
              }
            />
          </label>
          <label className="field">
            <span>Required hours/day</span>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={form.requiredHoursPerDay}
              onChange={(event) => updateForm("requiredHoursPerDay", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Allowed holidays</span>
            <input
              type="number"
              min="0"
              value={form.allowedHolidaysPerMonth}
              onChange={(event) => updateForm("allowedHolidaysPerMonth", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Bonus days</span>
            <input
              type="number"
              step="0.5"
              value={form.bonusDaysBalance}
              onChange={(event) => updateForm("bonusDaysBalance", Number(event.target.value))}
            />
          </label>
          <button className="primary-button" type="submit">
            Add staff
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-title">Pending signups</div>
        {pendingSignups.length === 0 ? <p className="muted-copy">No signups need approval.</p> : null}
        <div className="list-stack" aria-label="Pending signups">
          {pendingSignups.map((member) => (
            <article className="staff-row" key={member.id}>
              <div className="staff-row__head">
                <div>
                  <strong>{member.name}</strong>
                  <span>{ROLE_LABELS[member.role]}</span>
                </div>
                <span className="status-pill">{statusLabel(member)}</span>
              </div>
              <div className="staff-meta">
                <span>{member.phone}</span>
                <span>{locationName(member.defaultLocationId)}</span>
              </div>
              <div className="row-actions">
                <button className="primary-button" type="button" onClick={() => handleSignupApproval(member)}>
                  Approve
                </button>
                <button className="danger-button" type="button" onClick={() => handleSignupRejection(member)}>
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Staff roster</div>
        {loading ? <p className="muted-copy">Loading staff...</p> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <div className="list-stack" aria-label="Staff roster">
          {roster.map((member) => (
            <article className="staff-row" key={member.id}>
              <div className="staff-row__head">
                <div>
                  <strong>{member.name}</strong>
                  <span>{ROLE_LABELS[member.role]}</span>
                </div>
                <div className="staff-row__status">
                  <span className="status-pill">{statusLabel(member)}</span>
                  <button
                    className={member.active ? "danger-button" : "secondary-button"}
                    type="button"
                    onClick={() => handleActiveChange(member, !member.active)}
                  >
                    {member.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
              <div className="staff-meta">
                <span>{member.phone}</span>
                <span>{locationName(member.defaultLocationId)}</span>
                <span>{member.requiredHoursPerDay}h required</span>
              </div>

              <div className="compact-grid">
                <label className="field">
                  <span>Required hours/day</span>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={member.requiredHoursPerDay}
                    onChange={(event) =>
                      updateStaffRow(member.id, { requiredHoursPerDay: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>Allowed holidays</span>
                  <input
                    type="number"
                    min="0"
                    value={member.allowedHolidaysPerMonth}
                    onChange={(event) =>
                      updateStaffRow(member.id, { allowedHolidaysPerMonth: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>Bonus days</span>
                  <input
                    type="number"
                    step="0.5"
                    value={member.bonusDaysBalance}
                    onChange={(event) => updateStaffRow(member.id, { bonusDaysBalance: Number(event.target.value) })}
                  />
                </label>
              </div>
              <button className="secondary-button" type="button" onClick={() => handleHolidaySave(member)}>
                Save attendance rules
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
