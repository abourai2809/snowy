import { useEffect, useMemo, useState } from "react";
import type { Flavour } from "../../domain/flavours";
import { isLabRole, type LocationOption, type StaffProfile } from "../../domain/roles";
import { URGENT_REQUIREMENT_TYPE_LABELS, type UrgentRequirement } from "../../domain/urgentRequirements";
import { listFlavours } from "../catalog/catalogApi";
import { listLocations } from "../admin/staff/staffApi";
import { listVisibleUrgentRequirements, updateUrgentRequirementStatus } from "./urgentRequirementApi";

interface UrgentRequirementsPanelProps {
  profile: StaffProfile;
  locationId: string | null;
  title?: string;
}

export function UrgentRequirementsPanel({
  locationId,
  profile,
  title = "Active urgent requirements",
}: UrgentRequirementsPanelProps) {
  const [requirements, setRequirements] = useState<UrgentRequirement[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const flavourById = useMemo(() => new Map(flavours.map((flavour) => [flavour.id, flavour])), [flavours]);
  const canUpdate = profile.role === "admin" || profile.role === "store_manager" || profile.role === "lab_manager";

  async function refresh() {
    const [requirementRows, locationRows, flavourRows] = await Promise.all([
      listVisibleUrgentRequirements(profile.role, locationId),
      listLocations(),
      listFlavours(true),
    ]);
    setRequirements(requirementRows);
    setLocations(locationRows);
    setFlavours(flavourRows);
  }

  useEffect(() => {
    refresh().catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load urgent requirements."),
    );
  }, [locationId, profile.role]);

  async function updateStatus(requirement: UrgentRequirement, status: UrgentRequirement["status"]) {
    setSavingId(requirement.id);
    setError(null);
    try {
      await updateUrgentRequirementStatus({
        requirementId: requirement.id,
        status,
        actorId: profile.id,
        actorRole: profile.role,
      });
      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update urgent requirement.");
    } finally {
      setSavingId(null);
    }
  }

  const alertCopy = isLabRole(profile.role)
    ? "Lab should review these before planning dispatches."
    : locationId === "rajpur"
      ? "Rajpur can see urgent needs across stores."
      : "Track urgent needs sent from this store.";

  return (
    <section className="card urgent-card">
      <div className="card-title">{title}</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {requirements.length > 0 ? <div className="alert alert-danger">{alertCopy}</div> : null}
      {requirements.length === 0 ? <p className="muted-copy">No active urgent requirements.</p> : null}
      <div className="list-stack">
        {requirements.map((requirement) => (
          <article className="list-row vertical-row" key={requirement.id}>
            <div>
              <strong>
                {requirement.relatedFlavourId
                  ? flavourById.get(requirement.relatedFlavourId)?.name ?? "Gelato"
                  : URGENT_REQUIREMENT_TYPE_LABELS[requirement.requirementType]}
              </strong>
              <span>
                {locationById.get(requirement.sourceLocationId)?.name ?? requirement.sourceLocationId}
                {requirement.quantity ? ` / ${requirement.quantity} ${requirement.unit ?? ""}` : ""}
              </span>
              <span>{requirement.message}</span>
            </div>
            <span className="badge">{requirement.status.replace("_", " ")}</span>
            {canUpdate ? (
              <div className="action-row">
                {requirement.status === "submitted" ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={savingId === requirement.id}
                    onClick={() => void updateStatus(requirement, "acknowledged")}
                  >
                    Acknowledge
                  </button>
                ) : null}
                {requirement.status !== "in_progress" ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={savingId === requirement.id}
                    onClick={() => void updateStatus(requirement, "in_progress")}
                  >
                    In progress
                  </button>
                ) : null}
                <button
                  className="primary-button"
                  type="button"
                  disabled={savingId === requirement.id}
                  onClick={() => void updateStatus(requirement, "fulfilled")}
                >
                  Fulfilled
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={savingId === requirement.id}
                  onClick={() => void updateStatus(requirement, "cancelled")}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
