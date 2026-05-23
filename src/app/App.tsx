import { useEffect, useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
import { type AppRole, ROLE_LABELS } from "../domain/roles";
import {
  canAccessRoute,
  getDefaultRouteForRole,
  getRoute,
  getRouteCards,
  getRouteSummary,
  type RouteId,
} from "./routes";
import { MobileShell, type ShellUser } from "./layout/MobileShell";
import { AuthProvider, useAuth } from "../features/auth/AuthProvider";
import { LoginPage } from "../features/auth/LoginPage";
import { RequireRole } from "../features/auth/RequireRole";
import { AttendancePage } from "../features/attendance/AttendancePage";
import { StaffPage } from "../features/admin/staff/StaffPage";
import { AdminReportsPage } from "../features/admin/reports/AdminReportsPage";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { LabDashboard } from "../features/lab/LabDashboard";
import { StoreDashboard } from "../features/store/StoreDashboard";

interface AppProps {
  initialRole?: AppRole | null;
}

const locationLabels: Record<string, string> = {
  lab: "Lab",
  rajpur: "Rajpur Road",
  malsi: "Malsi",
  mussoorie: "Mussoorie",
};

export function App({ initialRole = null }: AppProps) {
  return (
    <AuthProvider initialRole={initialRole}>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { profile, signOut } = useAuth();
  const role = profile?.role;
  const [activeRoute, setActiveRoute] = useState<RouteId>(() => getDefaultRouteForRole(role ?? "admin"));

  useEffect(() => {
    if (role && !canAccessRoute(role, activeRoute)) {
      setActiveRoute(getDefaultRouteForRole(role));
    }
  }, [activeRoute, role]);

  const user: ShellUser | null = useMemo(
    () =>
      profile
        ? {
            name: profile.name,
            role: profile.role,
            locationLabel: profile.defaultLocationId
              ? locationLabels[profile.defaultLocationId] ?? profile.defaultLocationId
              : "All locations",
          }
        : null,
    [profile],
  );

  if (!user) {
    return <LoginPage />;
  }

  return (
    <MobileShell
      user={user}
      activeRoute={activeRoute}
      onNavigate={setActiveRoute}
      onLogout={() => {
        void signOut();
        setActiveRoute("dashboard");
      }}
    >
      <RoutePanel role={user.role} routeId={activeRoute} />
    </MobileShell>
  );
}

function RoutePanel({ role, routeId }: { role: AppRole; routeId: RouteId }) {
  const route = getRoute(routeId);
  const cards = getRouteCards(routeId, role);
  const Icon = route.icon;
  const customContent =
    routeId === "attendance" ? (
      <AttendancePage />
    ) : routeId === "lab" ? (
      <LabDashboard />
    ) : routeId === "store" ? (
      <StoreDashboard />
    ) : routeId === "stores" ? (
      <RequireRole allow={["admin"]}>
        <AdminReportsPage />
      </RequireRole>
    ) : routeId === "catalog" ? (
      <RequireRole allow={["admin"]}>
        <CatalogPage />
      </RequireRole>
    ) : routeId === "staff" ? (
      <RequireRole allow={["admin"]}>
        <StaffPage />
      </RequireRole>
    ) : null;

  return (
    <section className="page-panel" aria-labelledby="page-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{getRouteSummary(routeId)}</p>
          <h1 id="page-title">{route.label}</h1>
        </div>
        <div className="route-mark" aria-hidden="true">
          <Icon size={22} />
        </div>
      </div>

      <div className="status-strip" aria-label="Current role">
        <span>{ROLE_LABELS[role]}</span>
        <strong>{route.label}</strong>
      </div>

      {customContent ?? (
        <div className="work-grid" aria-label={`${route.label} sections`}>
          {cards.map((card) => (
            <button className="work-card" type="button" key={card}>
              <PackageSearch size={19} aria-hidden="true" />
              <span>{card}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
