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
  const [panWeightsKg, setPanWeightsKg] = useState<string[]>(["3.5"]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdPanIds, setCreatedPanIds] = useState<string[]>([]);

  const selectedFlavour = useMemo(
    () => flavours.find((flavour) => flavour.id === flavourId) ?? flavours[0],
    [flavourId, flavours],
  );

  function updatePanCount(value: number) {
    const nextCount = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
    setPanCount(nextCount);
    setPanWeightsKg((current) =>
      Array.from({ length: nextCount }, (_, index) => current[index] ?? current[current.length - 1] ?? "3.5"),
    );
  }

  function updatePanWeight(index: number, value: string) {
    setPanWeightsKg((current) => current.map((weight, currentIndex) => (currentIndex === index ? value : weight)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFlavour) {
      setError("Add an active flavour before recording production.");
      setMessage(null);
      setCreatedPanIds([]);
      return;
    }

    const parsedWeights = panWeightsKg.map((weight) => Number(weight));
    const weightError = parsedWeights
      .map((weight, index) => validateGelatoPanWeightKg(weight, { fieldName: `Pan ${index + 1} weight` }))
      .find(Boolean);
    if (weightError) {
      setError(weightError);
      setMessage(null);
      setCreatedPanIds([]);
      return;
    }

    try {
      const result = await createProduction({
        flavour: selectedFlavour,
        productionDate,
        panWeightsKg: parsedWeights,
        notes: notes.trim() || null,
        producedBy: profile.id,
      });
      setMessage(`Created ${result.pans.length} pan${result.pans.length === 1 ? "" : "s"} for ${selectedFlavour.name}.`);
      setCreatedPanIds(result.pans.map((pan) => pan.panId));
      setError(null);
      await onCreated();
    } catch (productionError) {
      setError(productionError instanceof Error ? productionError.message : "Unable to save production.");
      setMessage(null);
      setCreatedPanIds([]);
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
            onChange={(event) => updatePanCount(Number(event.target.value))}
          />
        </label>
        <div className="pan-weight-grid" aria-label="Pan weights">
          {panWeightsKg.map((weightKg, index) => (
            <label className="field compact-field" key={index}>
              <span>Pan {index + 1} weight kg</span>
              <input
                aria-label={`Pan ${index + 1} weight kg`}
                type="number"
                min="0"
                step="0.1"
                value={weightKg}
                onChange={(event) => updatePanWeight(index, event.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Material usage notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        </label>
        {message ? <div className="alert alert-success">{message}</div> : null}
        {createdPanIds.length ? (
          <div className="pan-id-result" aria-label="Pan IDs to label">
            <strong>Pan IDs to label</strong>
            <div className="pan-id-list">
              {createdPanIds.map((panId) => (
                <span className="pan-id-token" key={panId}>{panId}</span>
              ))}
            </div>
          </div>
        ) : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <button className="primary-button" type="submit">Save production</button>
      </form>
    </section>
  );
}
