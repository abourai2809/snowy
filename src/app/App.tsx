import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, PackageSearch } from "lucide-react";
import { APP_ROLES, type AppRole, ROLE_LABELS } from "../domain/roles";
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
  initialRole?: AppRole | null;
}

const previewLocations: Record<AppRole, string> = {
  admin: "All locations",
  store_manager: "All stores",
  lab_manager: "Lab",
  store_staff: "Rajpur Road",
  lab_staff: "Lab",
};

export function App({ initialRole = null }: AppProps) {
  const [role, setRole] = useState<AppRole | null>(initialRole);
  const [activeRoute, setActiveRoute] = useState<RouteId>(() =>
    getDefaultRouteForRole(initialRole ?? "admin"),
  );

  useEffect(() => {
    if (role && !canAccessRoute(role, activeRoute)) {
      setActiveRoute(getDefaultRouteForRole(role));
    }
  }, [activeRoute, role]);

  const user: ShellUser | null = useMemo(
    () =>
      role
        ? {
            name: ROLE_LABELS[role],
            role,
            locationLabel: previewLocations[role],
          }
        : null,
    [role],
  );

  if (!user) {
    return (
      <PersonaEntry
        onSelectRole={(nextRole) => {
          setRole(nextRole);
          setActiveRoute(getDefaultRouteForRole(nextRole));
        }}
      />
    );
  }

  return (
    <MobileShell
      user={user}
      activeRoute={activeRoute}
      onNavigate={setActiveRoute}
      onLogout={() => {
        setRole(null);
        setActiveRoute("dashboard");
      }}
    >
      <RoutePanel role={user.role} routeId={activeRoute} />
    </MobileShell>
  );
}

function PersonaEntry({ onSelectRole }: { onSelectRole: (role: AppRole) => void }) {
  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="login-mark">SO</div>
          <h1 id="login-title">Snowy Owl</h1>
          <p>Operations</p>
        </div>

        <div className="card">
          <div className="card-title">Open workspace</div>
          <div className="persona-list">
            {APP_ROLES.map((entryRole) => (
              <button
                className="persona-button"
                type="button"
                key={entryRole}
                onClick={() => onSelectRole(entryRole)}
              >
                <ClipboardCheck size={16} aria-hidden="true" />
                <span>{ROLE_LABELS[entryRole]}</span>
                <small>{previewLocations[entryRole]}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function RoutePanel({ role, routeId }: { role: AppRole; routeId: RouteId }) {
  const route = getRoute(routeId);
  const cards = getRouteCards(routeId, role);
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
