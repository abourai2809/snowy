import { useState, type FormEvent } from "react";
import type { CatalogItem, CatalogScope, Product } from "../../domain/catalog";
import { CATALOG_SCOPE_LABELS } from "../../domain/catalog";
import type { Flavour } from "../../domain/flavours";
import { removeProduct, saveProduct, setProductActive } from "./catalogApi";

interface ProductEditorProps {
  products: Product[];
  items: CatalogItem[];
  flavours: Flavour[];
  onChanged: () => Promise<void>;
}

const emptyForm = {
  productKey: "",
  name: "",
  catalogItemId: null as string | null,
  flavourId: null as string | null,
  scope: "store" as CatalogScope,
  trackInventory: true,
};

export function ProductEditor({ products, items, flavours, onChanged }: ProductEditorProps) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveProduct(form, editingId);
    setForm(emptyForm);
    setEditingId(undefined);
    await onChanged();
  }

  return (
    <section className="card">
      <div className="card-title">Products</div>
      <form className="staff-form" aria-label="Product form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Product key</span>
          <input value={form.productKey} onChange={(event) => setForm({ ...form, productKey: event.target.value })} required />
        </label>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label className="field">
          <span>Inventory item</span>
          <select value={form.catalogItemId ?? ""} onChange={(event) => setForm({ ...form, catalogItemId: event.target.value || null })}>
            <option value="">None</option>
            {items.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Flavour</span>
          <select value={form.flavourId ?? ""} onChange={(event) => setForm({ ...form, flavourId: event.target.value || null })}>
            <option value="">None</option>
            {flavours.map((flavour) => (
              <option value={flavour.id} key={flavour.id}>{flavour.name}</option>
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
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.trackInventory}
            onChange={(event) => setForm({ ...form, trackInventory: event.target.checked })}
          />
          <span>Track inventory</span>
        </label>
        <button className="primary-button" type="submit">
          {editingId ? "Save product" : "Add product"}
        </button>
      </form>

      <div className="list-stack catalog-list">
        {products.map((product) => (
          <article className="list-row catalog-row" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>{product.productKey} / {CATALOG_SCOPE_LABELS[product.scope]}</span>
            </div>
            <div className="row-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingId(product.id);
                  setForm({
                    productKey: product.productKey,
                    name: product.name,
                    catalogItemId: product.catalogItemId,
                    flavourId: product.flavourId,
                    scope: product.scope,
                    trackInventory: product.trackInventory,
                  });
                }}
              >
                Edit
              </button>
              <button className="secondary-button" type="button" onClick={async () => {
                await setProductActive(product.id, !product.active);
                await onChanged();
              }}>
                {product.active ? "Deactivate" : "Reactivate"}
              </button>
              <button className="danger-button" type="button" onClick={async () => {
                await removeProduct(product.id);
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
