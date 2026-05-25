import type { CatalogItemKind } from "../../domain/catalog";
import type { InventoryScope } from "../../domain/supplies";
import { useAuth } from "../auth/AuthProvider";
import { InventoryChecklist } from "./InventoryChecklist";

interface InventoryCountPageProps {
  title: string;
  scope: InventoryScope;
  kinds?: CatalogItemKind[];
}

export function InventoryCountPage({ kinds, scope, title }: InventoryCountPageProps) {
  const { activeAttendanceLoading, activeLocationId, profile } = useAuth();
  const locationId = scope === "store" ? activeLocationId : profile?.defaultLocationId ?? (scope === "lab" ? "lab" : null);

  if (scope === "store" && activeAttendanceLoading) {
    return <p className="muted-copy">Loading active store...</p>;
  }

  if (!profile || !locationId) {
    return <div className="alert alert-danger">Check in to select your store before using this checklist.</div>;
  }

  return (
    <InventoryChecklist
      title={title}
      scope={scope}
      kinds={kinds}
      locationId={locationId}
      actorId={profile.id}
      actorRole={profile.role}
      actorLocationId={locationId}
    />
  );
}
