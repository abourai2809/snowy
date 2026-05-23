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
  const { profile } = useAuth();
  const locationId = profile?.defaultLocationId ?? (scope === "lab" ? "lab" : null);

  if (!profile || !locationId) {
    return <div className="alert alert-danger">Assigned location is required.</div>;
  }

  return (
    <InventoryChecklist
      title={title}
      scope={scope}
      kinds={kinds}
      locationId={locationId}
      actorId={profile.id}
      actorRole={profile.role}
      actorLocationId={profile.defaultLocationId}
    />
  );
}
