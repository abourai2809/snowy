import { useState } from "react";
import type { FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "../../domain/roles";
import { isSupabaseConfigured } from "../../lib/supabase";
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(phone.trim(), password);
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="login-mark">SO</div>
          <h1 id="login-title">Snowy Owl</h1>
          <p>Operations</p>
        </div>

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
        </form>

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
