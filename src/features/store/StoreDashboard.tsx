import { useCallback, useEffect, useMemo, useState } from "react";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import { isStoreRole } from "../../domain/roles";
import { useAuth } from "../auth/AuthProvider";
import { listFlavours } from "../catalog/catalogApi";
import { InventoryCountPage } from "../inventory/InventoryCountPage";
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
} from "./storeApi";

export function StoreDashboard() {
  const { activeAttendanceLoading, activeLocationId, profile } = useAuth();
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [incoming, setIncoming] = useState<IncomingDispatch[]>([]);
  const [backupPans, setBackupPans] = useState<Pan[]>([]);
  const [displayPans, setDisplayPans] = useState<Pan[]>([]);
  const [urgentRefreshKey, setUrgentRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locationId = profile && isStoreRole(profile.role) ? activeLocationId : profile?.defaultLocationId ?? null;
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
      const [activeFlavours, incomingDispatches, backup, display] = await Promise.all([
        listFlavours(true),
        listIncomingDispatches(locationId),
        listBackupPans(locationId),
        listDisplayPans(locationId),
      ]);
      setFlavours(activeFlavours);
      setIncoming(incomingDispatches);
      setBackupPans(backup);
      setDisplayPans(display);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load store.");
    } finally {
      setLoading(false);
    }
  }, [activeAttendanceLoading, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) {
    return null;
  }

  if (activeAttendanceLoading) {
    return <p className="muted-copy">Loading active store...</p>;
  }

  if (!locationId) {
    return <div className="alert alert-danger">Check in to select your store before using store workflows.</div>;
  }

  return (
    <div className="page-stack">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <p className="muted-copy">Loading store...</p> : null}
      <section className="card">
        <div className="card-title">Store actions</div>
        <div className="quick-action-grid">
          <a className="quick-action" href="#incoming-pans">Incoming pans</a>
          <a className="quick-action" href="#morning-inventory-check">Morning check</a>
          <a className="quick-action" href="#urgent-requirement">Urgent need</a>
          <a className="quick-action" href="#move-to-display">Move to display</a>
          <a className="quick-action" href="#deep-freezer-weights">Deep freezer count</a>
          <a className="quick-action" href="#eod-gelato-weights">EOD gelato weights</a>
          <a className="quick-action" href="#store-supply-checklist">Supply count</a>
        </div>
      </section>
      <UrgentRequirementsPanel key={urgentRefreshKey} profile={profile} locationId={locationId} />
      <MorningInventoryVerification {...actor} locationId={locationId} businessDate={todayDate()} />
      <UrgentRequirementForm
        {...actor}
        locationId={locationId}
        flavours={flavours}
        onCreated={() => setUrgentRefreshKey((current) => current + 1)}
      />
      <div id="incoming-pans">
      <IncomingDispatches
        {...actor}
        locationId={locationId}
        dispatches={incoming}
        flavours={flavours}
        onChanged={() => void load()}
      />
      </div>
      <section className="card">
        <div className="card-title">Backup freezer</div>
        {backupPans.length === 0 ? <p className="muted-copy">No backup pans.</p> : null}
        <PanRows pans={backupPans} flavours={flavours} />
      </section>
      <div id="move-to-display">
        <DisplayMovementForm {...actor} locationId={locationId} backupPans={backupPans} flavours={flavours} onChanged={() => void load()} />
      </div>
      <section className="card">
        <div className="card-title">Display freezer</div>
        {displayPans.length === 0 ? <p className="muted-copy">No display pans.</p> : null}
        <PanRows pans={displayPans} flavours={flavours} />
      </section>
      <DeepFreezerCountForm {...actor} locationId={locationId} businessDate={todayDate()} flavours={flavours} />
      <EodGelatoCount {...actor} locationId={locationId} displayPans={displayPans} flavours={flavours} onChanged={() => void load()} />
      <div id="store-supply-checklist">
      <InventoryCountPage title="Store supply checklist" scope="store" />
      </div>
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
