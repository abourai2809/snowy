import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { APP_ROLES, ROLE_LABELS, type AppRole, type LocationOption } from "../../domain/roles";
import { isSupabaseConfigured } from "../../lib/supabase";
import { listLocations, requestStaffSignup, type StaffSignupInput } from "../admin/staff/staffApi";
import { useAuth } from "./AuthProvider";

const demoPhoneByRole: Record<AppRole, string> = {
  admin: "9876543210",
  store_manager: "9812345678",
  lab_manager: "9823456789",
  store_staff: "9834567890",
  lab_staff: "9845678901",
};

const demoLocationByRole: Record<AppRole, string> = {
  admin: "All locations",
  store_manager: "Rajpur Road",
  lab_manager: "Lab",
  store_staff: "Malsi",
  lab_staff: "Lab",
};

export function LoginPage() {
  const { error, loading, login, quickLogin } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [signupForm, setSignupForm] = useState<StaffSignupInput>({
    name: "",
    phone: "",
    password: "",
    role: "store_staff",
    defaultLocationId: "rajpur",
  });

  useEffect(() => {
    if (mode !== "signup") return;

    let mounted = true;
    listLocations()
      .then((rows) => {
        if (!mounted) return;
        setLocations(rows);
        setSignupForm((current) => ({
          ...current,
          defaultLocationId: current.defaultLocationId ?? rows[0]?.id ?? null,
        }));
      })
      .catch((loadError) => {
        if (!mounted) return;
        setSignupError(loadError instanceof Error ? loadError.message : "Unable to load locations.");
      });

    return () => {
      mounted = false;
    };
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(phone.trim(), password);
  }

  function updateSignupForm<K extends keyof StaffSignupInput>(key: K, value: StaffSignupInput[K]) {
    setSignupForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignupError(null);
    setSignupMessage(null);

    try {
      await requestStaffSignup(signupForm);
      setSignupMessage("Signup submitted. Ask Admin to approve before signing in.");
      setSignupForm({
        name: "",
        phone: "",
        password: "",
        role: "store_staff",
        defaultLocationId: locations[0]?.id ?? "rajpur",
      });
    } catch (submitError) {
      setSignupError(submitError instanceof Error ? submitError.message : "Unable to submit signup.");
    }
  }

  const staffRoles = APP_ROLES.filter((role): role is Exclude<AppRole, "admin"> => role !== "admin");

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="login-mark">SO</div>
          <h1 id="login-title">Snowy Owl</h1>
          <p>Operations</p>
        </div>

        {mode === "signin" ? (
          <form className="card login-form" onSubmit={handleSubmit}>
            <div className="card-title">Staff sign in</div>
            <label className="field">
              <span>Mobile number</span>
              <input
                inputMode="numeric"
                autoComplete="username"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit phone"
                maxLength={10}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
              />
            </label>
            {error ? <div className="alert alert-danger">{error}</div> : null}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <button className="secondary-button full-width-button" type="button" onClick={() => setMode("signup")}>
              Request staff access
            </button>
          </form>
        ) : (
          <form className="card login-form" onSubmit={handleSignupSubmit}>
            <div className="card-title">Request staff access</div>
            <label className="field">
              <span>Name</span>
              <input
                value={signupForm.name}
                onChange={(event) => updateSignupForm("name", event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Mobile number</span>
              <input
                inputMode="numeric"
                autoComplete="username"
                value={signupForm.phone}
                onChange={(event) => updateSignupForm("phone", event.target.value)}
                placeholder="10-digit phone"
                maxLength={10}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={signupForm.password}
                onChange={(event) => updateSignupForm("password", event.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select
                value={signupForm.role}
                onChange={(event) => updateSignupForm("role", event.target.value as StaffSignupInput["role"])}
              >
                {staffRoles.map((role) => (
                  <option value={role} key={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Location</span>
              <select
                value={signupForm.defaultLocationId ?? ""}
                onChange={(event) => updateSignupForm("defaultLocationId", event.target.value || null)}
              >
                {locations.map((location) => (
                  <option value={location.id} key={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            {signupError ? <div className="alert alert-danger">{signupError}</div> : null}
            {signupMessage ? <div className="alert alert-success">{signupMessage}</div> : null}
            <button className="primary-button" type="submit">
              Submit signup
            </button>
            <button className="secondary-button full-width-button" type="button" onClick={() => setMode("signin")}>
              Back to sign in
            </button>
          </form>
        )}

        {!isSupabaseConfigured ? (
          <div className="card">
            <div className="card-title">Demo entry</div>
            <div className="persona-list">
              {APP_ROLES.map((role) => (
                <button className="persona-button" type="button" key={role} onClick={() => quickLogin(role)}>
                  <ClipboardCheck size={16} aria-hidden="true" />
                  <span>{ROLE_LABELS[role]}</span>
                  <small>{demoLocationByRole[role]}</small>
                </button>
              ))}
            </div>
            <p className="demo-note">
              Demo password is <strong>{demoPhoneByRole.admin === phone ? "admin123" : "pass123"}</strong>.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
