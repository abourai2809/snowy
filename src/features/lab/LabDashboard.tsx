import { useEffect, useState } from "react";
import type { Flavour } from "../../domain/flavours";
import type { Dispatch } from "../../domain/dispatches";
import type { Pan } from "../../domain/pans";
import { listFlavours } from "../catalog/catalogApi";
import { useAuth } from "../auth/AuthProvider";
import { InventoryCountPage } from "../inventory/InventoryCountPage";
import { DispatchForm } from "./DispatchForm";
import { PanList } from "./PanList";
import { ProductionForm } from "./ProductionForm";
import { listAvailableLabPans, listLabDispatches, listLabPans } from "./labApi";

export function LabDashboard() {
  const { profile } = useAuth();
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [pans, setPans] = useState<Pan[]>([]);
  const [availablePans, setAvailablePans] = useState<Pan[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  async function refresh() {
    const [flavourRows, panRows, availableRows, dispatchRows] = await Promise.all([
      listFlavours(true),
      listLabPans(),
      listAvailableLabPans(),
      listLabDispatches(),
    ]);
    setFlavours(flavourRows);
    setPans(panRows);
    setAvailablePans(availableRows);
    setDispatches(dispatchRows);
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!profile) {
    return null;
  }

  return (
    <div className="page-stack">
      <ProductionForm flavours={flavours} profile={profile} onCreated={refresh} />
      <DispatchForm pans={availablePans} flavours={flavours} profile={profile} onDispatched={refresh} />
      <PanList pans={pans} flavours={flavours} />
      <InventoryCountPage title="Lab checklist" scope="lab" kinds={["raw_material", "supply", "packaging"]} />
      <section className="card">
        <div className="card-title">Recent dispatches</div>
        {dispatches.length === 0 ? <p className="muted-copy">No dispatches yet.</p> : null}
        <div className="list-stack">
          {dispatches.map((dispatch) => (
            <div className="list-row" key={dispatch.id}>
              <div>
                <strong>{dispatch.dispatchCode}</strong>
                <span>To {dispatch.toLocationId}</span>
              </div>
              <span className="badge">{dispatch.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
