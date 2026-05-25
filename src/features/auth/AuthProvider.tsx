import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AttendanceEntry } from "../../domain/attendance";
import type { AppRole, StaffProfile } from "../../domain/roles";
import {
  getDemoStaffByRole,
  getCurrentStaffProfile,
  loginWithPhone,
  signOutStaff,
} from "../admin/staff/staffApi";
import { getTodayAttendance } from "../attendance/attendanceApi";

interface AuthContextValue {
  profile: StaffProfile | null;
  activeAttendance: AttendanceEntry | null;
  activeAttendanceLoading: boolean;
  activeLocationId: string | null;
  loading: boolean;
  error: string | null;
  login: (phone: string, password: string) => Promise<void>;
  quickLogin: (role: AppRole) => void;
  refreshActiveAttendance: () => Promise<AttendanceEntry | null>;
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
  const [activeAttendance, setActiveAttendance] = useState<AttendanceEntry | null>(null);
  const [activeAttendanceLoading, setActiveAttendanceLoading] = useState(false);
  const [loading, setLoading] = useState(!initialRole);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRole) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    getCurrentStaffProfile()
      .then((currentProfile) => {
        if (!mounted) return;
        setProfile(currentProfile);
        setError(null);
      })
      .catch((restoreError) => {
        if (!mounted) return;
        setProfile(null);
        setError(restoreError instanceof Error ? restoreError.message : "Unable to restore session.");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [initialRole]);

  const refreshActiveAttendance = useCallback(async () => {
    if (!profile) {
      setActiveAttendance(null);
      setActiveAttendanceLoading(false);
      return null;
    }

    setActiveAttendanceLoading(true);
    try {
      const entry = await getTodayAttendance(profile.id);
      setActiveAttendance(entry);
      return entry;
    } finally {
      setActiveAttendanceLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    async function loadActiveAttendance() {
      if (!profile) {
        setActiveAttendance(null);
        setActiveAttendanceLoading(false);
        return;
      }

      setActiveAttendanceLoading(true);
      try {
        const entry = await getTodayAttendance(profile.id);
        if (mounted) {
          setActiveAttendance(entry);
        }
      } finally {
        if (mounted) {
          setActiveAttendanceLoading(false);
        }
      }
    }

    void loadActiveAttendance();

    return () => {
      mounted = false;
    };
  }, [profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      activeAttendance,
      activeAttendanceLoading,
      activeLocationId: activeAttendance?.locationId ?? null,
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
      refreshActiveAttendance,
      async signOut() {
        setLoading(true);
        try {
          await signOutStaff();
          setProfile(null);
          setActiveAttendance(null);
        } finally {
          setLoading(false);
        }
      },
    }),
    [activeAttendance, activeAttendanceLoading, error, loading, profile, refreshActiveAttendance],
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
