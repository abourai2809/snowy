import { useState, type FormEvent } from "react";
import type { DeepFreezerCountType } from "../../domain/inventory";
import { submitPhysicalEmptyPanCount, type StoreActor } from "./storeApi";

interface EmptyPanPhysicalCountFormProps extends StoreActor {
  locationId: string;
  businessDate: string;
  appEmptyPanCount: number;
  onChanged: () => void;
}

export function EmptyPanPhysicalCountForm({
  actorId,
  actorLocationId,
  actorRole,
  appEmptyPanCount,
  businessDate,
  locationId,
  onChanged,
}: EmptyPanPhysicalCountFormProps) {
  const [countType, setCountType] = useState<DeepFreezerCountType>("eod");
  const [physicalCount, setPhysicalCount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const result = await submitPhysicalEmptyPanCount({
        locationId,
        businessDate,
        countType,
        physicalCount: Number(physicalCount),
        notes: notes.trim() || null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setPhysicalCount("");
      setNotes("");
      setMessage(result.status === "matched" ? "Empty pan count matched." : "Empty pan count flagged for review.");
      onChanged();
    } catch (countError) {
      setError(countError instanceof Error ? countError.message : "Unable to submit empty pan count.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Physical empty pan count</div>
      <p className="muted-copy">App-calculated empty pans: {appEmptyPanCount}</p>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      <form aria-label="Physical empty pan count form" onSubmit={submit}>
        <label className="field">
          <span>Count time</span>
          <select value={countType} onChange={(event) => setCountType(event.target.value as DeepFreezerCountType)}>
            <option value="eod">End of day</option>
            <option value="morning">Beginning of day</option>
          </select>
        </label>
        <label className="field">
          <span>Physical empty pans</span>
          <input
            type="number"
            min="0"
            step="1"
            value={physicalCount}
            onChange={(event) => setPhysicalCount(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        </label>
        <button className="primary-button" type="submit">
          Submit count
        </button>
      </form>
    </section>
  );
}
