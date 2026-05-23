import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { AppRole } from "../../domain/roles";
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
  onLogout?: () => void;
  children: ReactNode;
}

export function MobileShell({
  user,
  activeRoute,
  onNavigate,
  onLogout,
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

        <div className="header-actions">
          <div className="user-chip">
            <span>{user.name}</span>
            <small>{user.locationLabel}</small>
          </div>
          {onLogout ? (
            <button className="logout-button" type="button" aria-label="Sign out" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <main className="app-main">{children}</main>

      <RoleNav role={user.role} activeRoute={activeRoute} onNavigate={onNavigate} />
    </div>
  );
}
