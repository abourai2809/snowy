import { useEffect, useState } from "react";
import type { CatalogItem } from "../../domain/catalog";
import type { Flavour } from "../../domain/flavours";
import type { Dispatch } from "../../domain/dispatches";
import type { Pan } from "../../domain/pans";
import { listCatalogItemsForScope, listFlavours } from "../catalog/catalogApi";
import { useAuth } from "../auth/AuthProvider";
import { DispatchForm } from "./DispatchForm";
import { PanList } from "./PanList";
import { ProductionForm } from "./ProductionForm";
import { listAvailableLabPans, listLabDispatches, listLabPans } from "./labApi";

export function LabDashboard() {
  const { profile } = useAuth();
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pans, setPans] = useState<Pan[]>([]);
  const [availablePans, setAvailablePans] = useState<Pan[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  async function refresh() {
    const [flavourRows, itemRows, panRows, availableRows, dispatchRows] = await Promise.all([
      listFlavours(true),
      listCatalogItemsForScope("lab", true, ["raw_material", "supply", "packaging"]),
      listLabPans(),
      listAvailableLabPans(),
      listLabDispatches(),
    ]);
    setFlavours(flavourRows);
    setItems(itemRows);
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
      <section className="card">
        <div className="card-title">Lab checklist</div>
        <div className="list-stack">
          {items.map((item) => (
            <div className="list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.unit} / min {item.defaultMinQty}</span>
              </div>
              <span className="badge">{item.scope}</span>
            </div>
          ))}
        </div>
      </section>
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
