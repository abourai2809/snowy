import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Flavour } from "../../../domain/flavours";
import type { LocationOption } from "../../../domain/roles";
import { useAuth } from "../../auth/AuthProvider";
import { listFlavours } from "../../catalog/catalogApi";
import { listLocations } from "../staff/staffApi";
import { DeepFreezerCountForm } from "../../store/DeepFreezerCountForm";
import { listStoreGelatoRequirements, saveStoreFlavourTarget } from "../../store/deepFreezerApi";
import type { StoreGelatoRequirement } from "../../../domain/inventory";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminDeepFreezerTools() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<LocationOption[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [requirements, setRequirements] = useState<StoreGelatoRequirement[]>([]);
  const [locationId, setLocationId] = useState("");
  const [businessDate, setBusinessDate] = useState(todayDate());
  const [targetFlavourId, setTargetFlavourId] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("6");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshRequirements() {
    setRequirements(await listStoreGelatoRequirements());
  }

  useEffect(() => {
    Promise.all([listLocations(), listFlavours(true), listStoreGelatoRequirements()])
      .then(([locationRows, flavourRows, requirementRows]) => {
        const storeRows = locationRows.filter((location) => location.type === "store");
        setStores(storeRows);
        setFlavours(flavourRows);
        setRequirements(requirementRows);
        setLocationId((current) => current || storeRows[0]?.id || "");
        setTargetFlavourId((current) => current || flavourRows[0]?.id || "");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load freezer tools."));
  }, []);

  async function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    try {
      const target = await saveStoreFlavourTarget({
        locationId,
        flavourId: targetFlavourId,
        targetWeightKg: Number(targetWeightKg),
        actorRole: profile.role,
      });
      setMessage(`Saved ${target.targetWeightKg} kg target.`);
      setError(null);
      await refreshRequirements();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save target.");
    }
  }

  if (!profile || profile.role !== "admin" || !locationId) {
    return null;
  }

  return (
    <>
      <section className="card">
        <div className="card-title">Store freezer setup</div>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {message ? <div className="alert alert-success">{message}</div> : null}
        <div className="compact-grid">
          <label className="field compact-field">
            <span>Store</span>
            <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {stores.map((store) => (
                <option value={store.id} key={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span>Count date</span>
            <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
          </label>
        </div>
        <form className="staff-form" aria-label="Store flavour target form" onSubmit={saveTarget}>
          <label className="field">
            <span>Target flavour</span>
            <select value={targetFlavourId} onChange={(event) => setTargetFlavourId(event.target.value)}>
              {flavours.map((flavour) => (
                <option value={flavour.id} key={flavour.id}>
                  {flavour.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Target kg</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetWeightKg}
              onChange={(event) => setTargetWeightKg(event.target.value)}
            />
          </label>
          <button className="secondary-button" type="submit" disabled={!targetFlavourId}>
            Save target
          </button>
        </form>
      </section>

      <DeepFreezerCountForm
        title="Initialize deep freezer weights"
        locationId={locationId}
        businessDate={businessDate}
        flavours={flavours}
        actorId={profile.id}
        actorRole={profile.role}
        actorLocationId={null}
      />

      <section className="card">
        <div className="card-title">Generated lab requirements</div>
        {requirements.length === 0 ? <p className="muted-copy">No store target gaps yet.</p> : null}
        <div className="list-stack">
          {requirements.slice(0, 12).map((requirement) => (
            <div className="list-row" key={requirement.id}>
              <div>
                <strong>{requirement.flavourName}</strong>
                <span>
                  {requirement.locationName}: {requirement.currentWeightKg} / {requirement.targetWeightKg} kg
                </span>
              </div>
              <span className="badge">{requirement.neededWeightKg.toFixed(2)} kg</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
