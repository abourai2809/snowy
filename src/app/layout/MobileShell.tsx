import { APP_ROLES, type AppRole, ROLE_LABELS } from "../../domain/roles";
import type { RouteId } from "../routes";
import { RoleNav } from "./RoleNav";

export interface ShellUser {
  name: string;
  role: AppRole;
  locationLabel: string;
}

interface MobileShellProps {
  user: ShellUser;
  activeRoute: RouteId;
  onNavigate: (routeId: RouteId) => void;
  onRoleChange?: (role: AppRole) => void;
  children: React.ReactNode;
}

export function MobileShell({
  user,
  activeRoute,
  onNavigate,
  onRoleChange,
  children,
}: MobileShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup" aria-label="Snowy Owl Operations">
          <div className="brand-mark">SO</div>
          <div>
            <p className="brand-title">Snowy Owl</p>
            <p className="brand-subtitle">Operations</p>
          </div>
        </div>

        <div className="user-chip">
          <span>{user.name}</span>
          <small>{user.locationLabel}</small>
        </div>
      </header>

      {onRoleChange ? (
        <div className="role-switcher">
          <label htmlFor="role-switch">Role</label>
          <select
            id="role-switch"
            value={user.role}
            onChange={(event) => onRoleChange(event.target.value as AppRole)}
          >
            {APP_ROLES.map((role) => (
              <option value={role} key={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <main className="app-main">{children}</main>

      <RoleNav role={user.role} activeRoute={activeRoute} onNavigate={onNavigate} />
    </div>
  );
}
