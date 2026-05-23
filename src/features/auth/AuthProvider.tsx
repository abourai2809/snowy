import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AppRole, StaffProfile } from "../../domain/roles";
import {
  getDemoStaffByRole,
  loginWithPhone,
  signOutStaff,
} from "../admin/staff/staffApi";

interface AuthContextValue {
  profile: StaffProfile | null;
  loading: boolean;
  error: string | null;
  login: (phone: string, password: string) => Promise<void>;
  quickLogin: (role: AppRole) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  initialRole?: AppRole | null;
  children: ReactNode;
}

export function AuthProvider({ initialRole = null, children }: AuthProviderProps) {
  const [profile, setProfile] = useState<StaffProfile | null>(() =>
    initialRole ? getDemoStaffByRole(initialRole) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      error,
      async login(phone, password) {
        setLoading(true);
        setError(null);
        try {
          setProfile(await loginWithPhone(phone, password));
        } catch (loginError) {
          setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
        } finally {
          setLoading(false);
        }
      },
      quickLogin(role) {
        setError(null);
        setProfile(getDemoStaffByRole(role));
      },
      async signOut() {
        setLoading(true);
        try {
          await signOutStaff();
          setProfile(null);
        } finally {
          setLoading(false);
        }
      },
    }),
    [error, loading, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
