import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { APP_ROLES, ROLE_LABELS, type AppRole, type LocationOption, type SalaryType, type StaffProfile } from "../../../domain/roles";
import {
  listLocations,
  listStaff,
  saveStaff,
  setStaffActive,
  updateHolidaySettings,
  type StaffInput,
} from "./staffApi";

const emptyForm: StaffInput = {
  name: "",
  phone: "",
  role: "store_staff",
  defaultLocationId: "rajpur",
  salaryAmount: null,
  salaryType: "daily",
  allowedHolidaysPerMonth: 0,
  bonusDaysBalance: 0,
};

export function StaffPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [form, setForm] = useState<StaffInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [staffRows, locationRows] = await Promise.all([listStaff(), listLocations()]);
      setStaff(staffRows);
      setLocations(locationRows);
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
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save staff.");
    }
  }

  async function handleHolidaySave(member: StaffProfile) {
    try {
      await updateHolidaySettings(member.id, member.allowedHolidaysPerMonth, member.bonusDaysBalance);
      await refresh();
    } catch (holidayError) {
      setError(holidayError instanceof Error ? holidayError.message : "Unable to update holidays.");
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

  return (
    <div className="page-stack">
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
        <div className="card-title">Staff roster</div>
        {loading ? <p className="muted-copy">Loading staff...</p> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <div className="list-stack" aria-label="Staff roster">
          {staff.map((member) => (
            <article className="staff-row" key={member.id}>
              <div className="staff-row__head">
                <div>
                  <strong>{member.name}</strong>
                  <span>{ROLE_LABELS[member.role]}</span>
                </div>
                <button
                  className={member.active ? "danger-button" : "secondary-button"}
                  type="button"
                  onClick={() => handleActiveChange(member, !member.active)}
                >
                  {member.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>

              <div className="compact-grid">
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
                Save holidays
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
