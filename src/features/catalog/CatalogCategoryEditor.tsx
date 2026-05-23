import { useState, type FormEvent } from "react";
import type { CatalogCategory, CatalogItemKind, CatalogScope } from "../../domain/catalog";
import { CATALOG_KIND_LABELS, CATALOG_SCOPE_LABELS } from "../../domain/catalog";
import { removeCategory, saveCategory, setCategoryActive } from "./catalogApi";

interface CatalogCategoryEditorProps {
  categories: CatalogCategory[];
  onChanged: () => Promise<void>;
}

const emptyForm = {
  categoryKey: "",
  name: "",
  itemKind: "supply" as CatalogItemKind,
  scope: "store" as CatalogScope,
};

export function CatalogCategoryEditor({ categories, onChanged }: CatalogCategoryEditorProps) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveCategory(form, editingId);
    setForm(emptyForm);
    setEditingId(undefined);
    await onChanged();
  }

  return (
    <section className="card">
      <div className="card-title">Categories</div>
      <form className="staff-form" aria-label="Category form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Category key</span>
          <input value={form.categoryKey} onChange={(event) => setForm({ ...form, categoryKey: event.target.value })} required />
        </label>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
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
        <button className="primary-button" type="submit">
          {editingId ? "Save category" : "Add category"}
        </button>
      </form>

      <div className="list-stack catalog-list">
        {categories.map((category) => (
          <article className="list-row catalog-row" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <span>{category.categoryKey} / {CATALOG_SCOPE_LABELS[category.scope]}</span>
            </div>
            <div className="row-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingId(category.id);
                  setForm({
                    categoryKey: category.categoryKey,
                    name: category.name,
                    itemKind: category.itemKind,
                    scope: category.scope,
                  });
                }}
              >
                Edit
              </button>
              <button className="secondary-button" type="button" onClick={async () => {
                await setCategoryActive(category.id, !category.active);
                await onChanged();
              }}>
                {category.active ? "Deactivate" : "Reactivate"}
              </button>
              <button className="danger-button" type="button" onClick={async () => {
                await removeCategory(category.id);
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
