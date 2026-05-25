import { useMemo, useState, type FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import type { StaffProfile } from "../../domain/roles";
import { validateGelatoPanWeightKg } from "../../domain/weights";
import { createProduction } from "./labApi";

interface ProductionFormProps {
  flavours: Flavour[];
  profile: StaffProfile;
  onCreated: () => Promise<void>;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function ProductionForm({ flavours, profile, onCreated }: ProductionFormProps) {
  const [flavourId, setFlavourId] = useState("");
  const [productionDate, setProductionDate] = useState(todayKey());
  const [panCount, setPanCount] = useState(1);
  const [fullWeightKg, setFullWeightKg] = useState(3.5);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFlavour = useMemo(
    () => flavours.find((flavour) => flavour.id === flavourId) ?? flavours[0],
    [flavourId, flavours],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFlavour) {
      setError("Add an active flavour before recording production.");
      return;
    }

    const weightError = validateGelatoPanWeightKg(fullWeightKg, { fieldName: "Full pan weight" });
    if (weightError) {
      setError(weightError);
      setMessage(null);
      return;
    }

    try {
      const result = await createProduction({
        flavour: selectedFlavour,
        productionDate,
        panCount,
        fullWeightKg,
        notes: notes.trim() || null,
        producedBy: profile.id,
      });
      setMessage(`Created ${result.pans.length} pan${result.pans.length === 1 ? "" : "s"} for ${selectedFlavour.name}.`);
      setError(null);
      await onCreated();
    } catch (productionError) {
      setError(productionError instanceof Error ? productionError.message : "Unable to save production.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Add lab production</div>
      <form className="staff-form" aria-label="Production form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Production flavour</span>
          <select value={selectedFlavour?.id ?? ""} onChange={(event) => setFlavourId(event.target.value)}>
            {flavours.map((flavour) => (
              <option value={flavour.id} key={flavour.id}>{flavour.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Production date</span>
          <input type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Pan count</span>
          <input
            type="number"
            min="1"
            value={panCount}
            onChange={(event) => setPanCount(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Full pan weight kg</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={fullWeightKg}
            onChange={(event) => setFullWeightKg(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Material usage notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        </label>
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <button className="primary-button" type="submit">Save production</button>
      </form>
    </section>
  );
}
