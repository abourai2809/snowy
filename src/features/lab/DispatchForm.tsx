import { useEffect, useState, type FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import type { StaffProfile, LocationOption } from "../../domain/roles";
import { listLocations } from "../admin/staff/staffApi";
import { createDispatch } from "./labApi";

interface DispatchFormProps {
  pans: Pan[];
  flavours: Flavour[];
  profile: StaffProfile;
  onDispatched: () => Promise<void>;
}

export function DispatchForm({ pans, flavours, profile, onDispatched }: DispatchFormProps) {
  const [stores, setStores] = useState<LocationOption[]>([]);
  const [toLocationId, setToLocationId] = useState("");
  const [selectedPanIds, setSelectedPanIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));

  useEffect(() => {
    void listLocations().then((locations) => {
      const storeRows = locations.filter((location) => location.type === "store");
      setStores(storeRows);
      setToLocationId((current) => current || storeRows[0]?.id || "");
    });
  }, []);

  function togglePan(panId: string, checked: boolean) {
    setSelectedPanIds((current) => checked ? [...current, panId] : current.filter((id) => id !== panId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createDispatch({
        panUuids: selectedPanIds,
        toLocationId,
        dispatchedBy: profile.id,
        notes: notes.trim() || null,
      });
      setMessage(`Moved ${selectedPanIds.length} pan${selectedPanIds.length === 1 ? "" : "s"} to store.`);
      setSelectedPanIds([]);
      setNotes("");
      setError(null);
      await onDispatched();
    } catch (dispatchError) {
      setError(dispatchError instanceof Error ? dispatchError.message : "Unable to dispatch pans.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Move inventory to store</div>
      <form className="staff-form" aria-label="Move inventory to store form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Destination store</span>
          <select value={toLocationId} onChange={(event) => setToLocationId(event.target.value)}>
            {stores.map((store) => (
              <option value={store.id} key={store.id}>{store.name}</option>
            ))}
          </select>
        </label>
        <div className="checklist" aria-label="Available pans">
          {pans.length === 0 ? <p className="muted-copy">No available lab inventory to move.</p> : null}
          {pans.map((pan) => (
            <label className="check-row" key={pan.id}>
              <input
                type="checkbox"
                checked={selectedPanIds.includes(pan.id)}
                onChange={(event) => togglePan(pan.id, event.target.checked)}
              />
              <span>{pan.panId}</span>
              <small>{flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"}</small>
            </label>
          ))}
        </div>
        <label className="field">
          <span>Dispatch notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        </label>
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <button className="primary-button" type="submit">Move selected pans to store</button>
      </form>
    </section>
  );
}
