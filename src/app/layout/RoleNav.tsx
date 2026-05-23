import type { AppRole } from "../../domain/roles";
import { getRoutesForRole, type RouteId } from "../routes";

interface RoleNavProps {
  role: AppRole;
  activeRoute: RouteId;
  onNavigate: (routeId: RouteId) => void;
}

export function RoleNav({ role, activeRoute, onNavigate }: RoleNavProps) {
  const routes = getRoutesForRole(role);

  return (
    <nav className="role-nav" aria-label="Primary navigation">
      {routes.map((route) => {
        const Icon = route.icon;
        const active = route.id === activeRoute;

        return (
          <button
            className="role-nav__item"
            type="button"
            aria-current={active ? "page" : undefined}
            aria-label={route.label}
            data-active={active}
            key={route.id}
            onClick={() => onNavigate(route.id)}
          >
            <Icon size={20} aria-hidden="true" strokeWidth={2.2} />
            <span>{route.navLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
