import { useState, type FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import { removeFlavour, saveFlavour, setFlavourActive } from "./catalogApi";

interface FlavourEditorProps {
  flavours: Flavour[];
  onChanged: () => Promise<void>;
}

const emptyForm = {
  name: "",
  shortCode: "",
  seasonal: false,
  sorbet: false,
};

export function FlavourEditor({ flavours, onChanged }: FlavourEditorProps) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveFlavour(form, editingId);
      setForm(emptyForm);
      setEditingId(undefined);
      setError(null);
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save flavour.");
    }
  }

  async function setActive(flavour: Flavour, active: boolean) {
    await setFlavourActive(flavour.id, active);
    await onChanged();
  }

  async function remove(flavour: Flavour) {
    await removeFlavour(flavour.id);
    await onChanged();
  }

  return (
    <section className="card">
      <div className="card-title">Flavours</div>
      <form className="staff-form" aria-label="Flavour form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label className="field">
          <span>Short code</span>
          <input
            value={form.shortCode}
            onChange={(event) => setForm({ ...form, shortCode: event.target.value.toUpperCase() })}
            maxLength={6}
            required
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.seasonal}
            onChange={(event) => setForm({ ...form, seasonal: event.target.checked })}
          />
          <span>Seasonal</span>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.sorbet}
            onChange={(event) => setForm({ ...form, sorbet: event.target.checked })}
          />
          <span>Sorbet</span>
        </label>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <button className="primary-button" type="submit">
          {editingId ? "Save flavour" : "Add flavour"}
        </button>
      </form>

      <div className="list-stack catalog-list">
        {flavours.map((flavour) => (
          <article className="list-row catalog-row" key={flavour.id}>
            <div>
              <strong>{flavour.name}</strong>
              <span>{flavour.shortCode} {flavour.active ? "" : "Inactive"}</span>
            </div>
            <div className="row-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingId(flavour.id);
                  setForm({
                    name: flavour.name,
                    shortCode: flavour.shortCode,
                    seasonal: flavour.seasonal,
                    sorbet: flavour.sorbet,
                  });
                }}
              >
                Edit
              </button>
              <button className="secondary-button" type="button" onClick={() => setActive(flavour, !flavour.active)}>
                {flavour.active ? "Deactivate" : "Reactivate"}
              </button>
              <button className="danger-button" type="button" onClick={() => remove(flavour)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
