import type { ReactNode } from "react";
import type { AppRole } from "../../domain/roles";
import { ROLE_LABELS } from "../../domain/roles";
import { useAuth } from "./AuthProvider";

interface RequireRoleProps {
  allow: readonly AppRole[];
  children: ReactNode;
}

export function RequireRole({ allow, children }: RequireRoleProps) {
  const { profile } = useAuth();

  if (!profile || !allow.includes(profile.role)) {
    return (
      <section className="card access-panel" aria-label="Access denied">
        <div className="card-title">Access denied</div>
        <p>
          {profile ? ROLE_LABELS[profile.role] : "This user"} cannot open this page.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}
