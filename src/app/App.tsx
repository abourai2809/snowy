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

interface AppProps {
  initialRole?: AppRole;
}

const previewLocations: Record<AppRole, string> = {
  admin: "All locations",
  store_manager: "All stores",
  lab_manager: "Lab",
  store_staff: "Assigned store",
  lab_staff: "Lab",
};

export function App({ initialRole = "admin" }: AppProps) {
  const [role, setRole] = useState<AppRole>(initialRole);
  const [activeRoute, setActiveRoute] = useState<RouteId>(() => getDefaultRouteForRole(initialRole));

  useEffect(() => {
    if (!canAccessRoute(role, activeRoute)) {
      setActiveRoute(getDefaultRouteForRole(role));
    }
  }, [activeRoute, role]);

  const user: ShellUser = useMemo(
    () => ({
      name: ROLE_LABELS[role],
      role,
      locationLabel: previewLocations[role],
    }),
    [role],
  );

  return (
    <MobileShell
      user={user}
      activeRoute={activeRoute}
      onNavigate={setActiveRoute}
      onRoleChange={setRole}
    >
      <RoutePanel role={role} routeId={activeRoute} />
    </MobileShell>
  );
}

function RoutePanel({ role, routeId }: { role: AppRole; routeId: RouteId }) {
  const route = getRoute(routeId);
  const cards = getRouteCards(routeId);
  const Icon = route.icon;

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

      <div className="work-grid" aria-label={`${route.label} sections`}>
        {cards.map((card) => (
          <button className="work-card" type="button" key={card}>
            <PackageSearch size={19} aria-hidden="true" />
            <span>{card}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
