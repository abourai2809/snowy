import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import { isStoreRole, type LocationOption, type StaffProfile } from "../../domain/roles";
import { useAuth } from "../auth/AuthProvider";
import { listLocations } from "../admin/staff/staffApi";
import { listFlavours } from "../catalog/catalogApi";
import { InventoryCountPage } from "../inventory/InventoryCountPage";
import { LocationValidationGate } from "../location/LocationValidationGate";
import { UrgentRequirementForm } from "../urgentRequirements/UrgentRequirementForm";
import { UrgentRequirementsPanel } from "../urgentRequirements/UrgentRequirementsPanel";
import { IncomingDispatches } from "./IncomingDispatches";
import { DisplayMovementForm } from "./DisplayMovementForm";
import { DeepFreezerCountForm } from "./DeepFreezerCountForm";
import { EodGelatoCount } from "./EodGelatoCount";
import { MorningInventoryVerification } from "./MorningInventoryVerification";
import {
  listBackupPans,
  listDisplayPans,
  listIncomingDispatches,
  type IncomingDispatch,
  type StoreActor,
} from "./storeApi";

const STORE_ACTIONS = [
  { id: "incoming-pans", label: "Incoming pans", workflowName: "incoming pans" },
  { id: "morning-inventory-check", label: "Morning check", workflowName: "morning inventory check" },
  { id: "urgent-requirement", label: "Urgent need", workflowName: "urgent requirement" },
  { id: "move-to-display", label: "Move to display", workflowName: "move to display" },
  { id: "deep-freezer-weights", label: "Deep freezer count", workflowName: "EOD deep freezer weights" },
  { id: "eod-gelato-weights", label: "EOD gelato weights", workflowName: "EOD gelato weights" },
  { id: "store-supply-checklist", label: "Supply count", workflowName: "store supply checklist" },
] as const;

type StoreActionId = (typeof STORE_ACTIONS)[number]["id"];

export function StoreDashboard() {
  const { activeAttendanceLoading, activeLocationId, profile } = useAuth();
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [incoming, setIncoming] = useState<IncomingDispatch[]>([]);
  const [backupPans, setBackupPans] = useState<Pan[]>([]);
  const [displayPans, setDisplayPans] = useState<Pan[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [activeActionId, setActiveActionId] = useState<StoreActionId | null>(null);
  const [urgentRefreshKey, setUrgentRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locationId = profile && isStoreRole(profile.role) ? activeLocationId : profile?.defaultLocationId ?? null;
  const currentLocation = locationId ? locations.find((location) => location.id === locationId) ?? null : null;
  const actor = useMemo(
    () => ({
      actorId: profile?.id ?? null,
      actorRole: profile?.role ?? "store_staff",
      actorLocationId: locationId,
    }),
    [locationId, profile],
  );

  const load = useCallback(async () => {
    if (activeAttendanceLoading) {
      return;
    }

    if (!locationId) {
      setLoading(false);
      setError("Check in to select your store before using store workflows.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [activeFlavours, incomingDispatches, backup, display, locationRows] = await Promise.all([
        listFlavours(true),
        listIncomingDispatches(locationId),
        listBackupPans(locationId),
        listDisplayPans(locationId),
        listLocations(),
      ]);
      setFlavours(activeFlavours);
      setIncoming(incomingDispatches);
      setBackupPans(backup);
      setDisplayPans(display);
      setLocations(locationRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load store.");
    } finally {
      setLoading(false);
    }
  }, [activeAttendanceLoading, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveActionId(null);
  }, [locationId]);

  if (!profile) {
    return null;
  }

  if (activeAttendanceLoading) {
    return <p className="muted-copy">Loading active store...</p>;
  }

  if (!locationId) {
    return <div className="alert alert-danger">Check in to select your store before using store workflows.</div>;
  }

  const activeAction = activeActionId ? getStoreAction(activeActionId) : null;

  if (activeAction) {
    return (
      <div className="page-stack">
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {loading ? <p className="muted-copy">Loading store...</p> : null}
        <section className="card">
          <div className="card-title">{activeAction.label}</div>
          <p className="muted-copy">
            Current store: <strong>{currentLocation?.name ?? locationId}</strong>
          </p>
          <button className="secondary-button" type="button" onClick={() => setActiveActionId(null)}>
            Back to store actions
          </button>
        </section>
        {withLocationValidation(
          currentLocation,
          activeAction.id,
          activeAction.workflowName,
          renderStoreAction({
            actionId: activeAction.id,
            actor,
            backupPans,
            displayPans,
            flavours,
            incoming,
            load,
            locationId,
            profile,
            urgentRefreshKey,
            setUrgentRefreshKey,
          }),
        )}
      </div>
    );
  }

  return (
    <div className="page-stack">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <p className="muted-copy">Loading store...</p> : null}
      <section className="card">
        <div className="card-title">Store actions</div>
        <p className="muted-copy">
          Current store: <strong>{currentLocation?.name ?? locationId}</strong>
        </p>
        <div className="quick-action-grid">
          {STORE_ACTIONS.map((action) => (
            <button
              className="quick-action"
              type="button"
              key={action.id}
              disabled={loading || !currentLocation}
              onClick={() => setActiveActionId(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function PanRows({ pans, flavours }: { pans: Pan[]; flavours: Flavour[] }) {
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));

  if (pans.length === 0) {
    return null;
  }

  return (
    <div className="list-stack">
      {pans.map((pan) => (
        <article className="list-row" key={pan.id}>
          <div>
            <strong>{flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"}</strong>
            <span>{pan.panId}</span>
          </div>
          <span className="badge">{pan.currentWeightKg ?? "-"} kg</span>
        </article>
      ))}
    </div>
  );
}

interface StoreActionContext {
  actionId: StoreActionId;
  actor: StoreActor;
  backupPans: Pan[];
  displayPans: Pan[];
  flavours: Flavour[];
  incoming: IncomingDispatch[];
  load: () => Promise<void>;
  locationId: string;
  profile: StaffProfile;
  urgentRefreshKey: number;
  setUrgentRefreshKey: (update: (current: number) => number) => void;
}

function renderStoreAction({
  actionId,
  actor,
  backupPans,
  displayPans,
  flavours,
  incoming,
  load,
  locationId,
  profile,
  urgentRefreshKey,
  setUrgentRefreshKey,
}: StoreActionContext): ReactNode {
  switch (actionId) {
    case "incoming-pans":
      return (
        <IncomingDispatches
          {...actor}
          locationId={locationId}
          dispatches={incoming}
          flavours={flavours}
          onChanged={() => void load()}
        />
      );
    case "morning-inventory-check":
      return <MorningInventoryVerification {...actor} locationId={locationId} businessDate={todayDate()} />;
    case "urgent-requirement":
      return (
        <>
          <UrgentRequirementsPanel key={urgentRefreshKey} profile={profile} locationId={locationId} />
          <UrgentRequirementForm
            {...actor}
            locationId={locationId}
            flavours={flavours}
            onCreated={() => setUrgentRefreshKey((current) => current + 1)}
          />
        </>
      );
    case "move-to-display":
      return (
        <>
          <section className="card">
            <div className="card-title">Backup freezer</div>
            {backupPans.length === 0 ? <p className="muted-copy">No backup pans.</p> : null}
            <PanRows pans={backupPans} flavours={flavours} />
          </section>
          <DisplayMovementForm
            {...actor}
            locationId={locationId}
            backupPans={backupPans}
            flavours={flavours}
            onChanged={() => void load()}
          />
        </>
      );
    case "deep-freezer-weights":
      return <DeepFreezerCountForm {...actor} locationId={locationId} businessDate={todayDate()} flavours={flavours} />;
    case "eod-gelato-weights":
      return (
        <>
          <section className="card">
            <div className="card-title">Display freezer</div>
            {displayPans.length === 0 ? <p className="muted-copy">No display pans.</p> : null}
            <PanRows pans={displayPans} flavours={flavours} />
          </section>
          <EodGelatoCount
            {...actor}
            locationId={locationId}
            displayPans={displayPans}
            flavours={flavours}
            onChanged={() => void load()}
          />
        </>
      );
    case "store-supply-checklist":
      return <InventoryCountPage title="Store supply checklist" scope="store" />;
  }
}

function getStoreAction(actionId: StoreActionId) {
  const action = STORE_ACTIONS.find((item) => item.id === actionId);
  if (!action) {
    throw new Error(`Unknown store action: ${actionId}`);
  }
  return action;
}

function withLocationValidation(
  location: LocationOption | null,
  id: string,
  workflowName: string,
  children: ReactNode,
) {
  if (!location) {
    return (
      <section className="card" id={id}>
        <p className="muted-copy">Loading current store...</p>
      </section>
    );
  }

  return (
    <LocationValidationGate id={id} location={location} workflowName={workflowName}>
      {children}
    </LocationValidationGate>
  );
}
