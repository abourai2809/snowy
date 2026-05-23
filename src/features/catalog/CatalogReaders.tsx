import { useEffect, useState } from "react";
import type { CatalogItem } from "../../domain/catalog";
import type { Flavour } from "../../domain/flavours";
import { listCatalogItemsForScope, listFlavours } from "./catalogApi";

export function LabCatalogPreview() {
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    void Promise.all([
      listFlavours(true),
      listCatalogItemsForScope("lab", true, ["raw_material", "supply", "packaging"]),
    ]).then(([flavourRows, itemRows]) => {
      setFlavours(flavourRows);
      setItems(itemRows);
    });
  }, []);

  return (
    <div className="page-stack">
      <section className="card">
        <div className="card-title">Production</div>
        <label className="field">
          <span>Production flavour</span>
          <select>
            {flavours.map((flavour) => (
              <option value={flavour.id} key={flavour.id}>{flavour.name}</option>
            ))}
          </select>
        </label>
      </section>
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
    </div>
  );
}

export function StoreCatalogPreview() {
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    void listCatalogItemsForScope("store", true).then(setItems);
  }, []);

  return (
    <section className="card">
      <div className="card-title">Store supply checklist</div>
      <div className="list-stack" aria-label="Store supply checklist">
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
  );
}
