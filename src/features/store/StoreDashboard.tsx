import { useCallback, useEffect, useMemo, useState } from "react";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import { useAuth } from "../auth/AuthProvider";
import { listFlavours } from "../catalog/catalogApi";
import { InventoryCountPage } from "../inventory/InventoryCountPage";
import { IncomingDispatches } from "./IncomingDispatches";
import { DisplayMovementForm } from "./DisplayMovementForm";
import { EodGelatoCount } from "./EodGelatoCount";
import {
  listBackupPans,
  listDisplayPans,
  listIncomingDispatches,
  type IncomingDispatch,
} from "./storeApi";

export function StoreDashboard() {
  const { profile } = useAuth();
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [incoming, setIncoming] = useState<IncomingDispatch[]>([]);
  const [backupPans, setBackupPans] = useState<Pan[]>([]);
  const [displayPans, setDisplayPans] = useState<Pan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locationId = profile?.defaultLocationId ?? null;
  const actor = useMemo(
    () => ({
      actorId: profile?.id ?? null,
      actorRole: profile?.role ?? "store_staff",
      actorLocationId: profile?.defaultLocationId ?? null,
    }),
    [profile],
  );

  const load = useCallback(async () => {
    if (!locationId) {
      setLoading(false);
      setError("Assigned store is required.");
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
  }, [locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) {
    return null;
  }

  if (!locationId) {
    return <div className="alert alert-danger">Assigned store is required.</div>;
  }

  return (
    <div className="page-stack">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <p className="muted-copy">Loading store...</p> : null}
      <section className="card">
        <div className="card-title">Store actions</div>
        <div className="quick-action-grid">
          <a className="quick-action" href="#incoming-pans">Incoming pans</a>
          <a className="quick-action" href="#move-to-display">Move to display</a>
          <a className="quick-action" href="#eod-gelato-weights">EOD gelato weights</a>
          <a className="quick-action" href="#store-supply-checklist">Supply count</a>
        </div>
      </section>
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
      <EodGelatoCount {...actor} locationId={locationId} displayPans={displayPans} flavours={flavours} onChanged={() => void load()} />
      <div id="store-supply-checklist">
      <InventoryCountPage title="Store supply checklist" scope="store" />
      </div>
    </div>
  );
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
