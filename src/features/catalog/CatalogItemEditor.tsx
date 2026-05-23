import { useState, type FormEvent } from "react";
import type { CatalogCategory, CatalogItem, CatalogItemKind, CatalogScope } from "../../domain/catalog";
import { CATALOG_KIND_LABELS, CATALOG_SCOPE_LABELS } from "../../domain/catalog";
import { removeCatalogItem, saveCatalogItem, setCatalogItemActive } from "./catalogApi";

interface CatalogItemEditorProps {
  items: CatalogItem[];
  categories: CatalogCategory[];
  onChanged: () => Promise<void>;
}

const emptyForm = {
  itemKey: "",
  categoryId: "",
  name: "",
  itemKind: "supply" as CatalogItemKind,
  scope: "store" as CatalogScope,
  unit: "pcs",
  defaultMinQty: 0,
  trackInventory: true,
};

export function CatalogItemEditor({ items, categories, onChanged }: CatalogItemEditorProps) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState({ ...emptyForm, categoryId: categories[0]?.id ?? "" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveCatalogItem(form, editingId);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setEditingId(undefined);
    await onChanged();
  }

  return (
    <section className="card">
      <div className="card-title">Items</div>
      <form className="staff-form" aria-label="Catalog item form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Item key</span>
          <input value={form.itemKey} onChange={(event) => setForm({ ...form, itemKey: event.target.value })} required />
        </label>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Kind</span>
          <select value={form.itemKind} onChange={(event) => setForm({ ...form, itemKind: event.target.value as CatalogItemKind })}>
            {Object.entries(CATALOG_KIND_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Scope</span>
          <select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as CatalogScope })}>
            {Object.entries(CATALOG_SCOPE_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Unit</span>
          <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required />
        </label>
        <label className="field">
          <span>Minimum quantity</span>
          <input
            type="number"
            value={form.defaultMinQty}
            onChange={(event) => setForm({ ...form, defaultMinQty: Number(event.target.value) })}
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.trackInventory}
            onChange={(event) => setForm({ ...form, trackInventory: event.target.checked })}
          />
          <span>Track inventory</span>
        </label>
        <button className="primary-button" type="submit">
          {editingId ? "Save item" : "Add item"}
        </button>
      </form>

      <div className="list-stack catalog-list">
        {items.map((item) => (
          <article className="list-row catalog-row" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{CATALOG_KIND_LABELS[item.itemKind]} / {CATALOG_SCOPE_LABELS[item.scope]} / {item.unit}</span>
            </div>
            <div className="row-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setForm({
                    itemKey: item.itemKey,
                    categoryId: item.categoryId,
                    name: item.name,
                    itemKind: item.itemKind,
                    scope: item.scope,
                    unit: item.unit,
                    defaultMinQty: item.defaultMinQty,
                    trackInventory: item.trackInventory,
                  });
                }}
              >
                Edit
              </button>
              <button className="secondary-button" type="button" onClick={async () => {
                await setCatalogItemActive(item.id, !item.active);
                await onChanged();
              }}>
                {item.active ? "Deactivate" : "Reactivate"}
              </button>
              <button className="danger-button" type="button" onClick={async () => {
                await removeCatalogItem(item.id);
                await onChanged();
              }}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
