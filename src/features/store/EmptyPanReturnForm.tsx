import { useEffect, useState, type FormEvent } from "react";
import type { EmptyPanReturn } from "../../domain/inventory";
import { createEmptyPanReturn, listEmptyPanReturns, type StoreActor } from "./storeApi";

interface EmptyPanReturnFormProps extends StoreActor {
  locationId: string;
  appEmptyPanCount: number;
  onChanged: () => void;
}

export function EmptyPanReturnForm({
  actorId,
  actorLocationId,
  actorRole,
  appEmptyPanCount,
  locationId,
  onChanged,
}: EmptyPanReturnFormProps) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [returns, setReturns] = useState<EmptyPanReturn[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReturns() {
    setReturns((await listEmptyPanReturns()).filter((emptyReturn) => emptyReturn.sourceLocationId === locationId));
  }

  useEffect(() => {
    void loadReturns();
  }, [locationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await createEmptyPanReturn({
        sourceLocationId: locationId,
        quantity: Number(quantity),
        notes: notes.trim() || null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setQuantity("");
      setNotes("");
      setMessage("Empty pan return sent to lab.");
      await loadReturns();
      onChanged();
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : "Unable to send empty pan return.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Return empty pans</div>
      <p className="muted-copy">App-calculated empty pans: {appEmptyPanCount}</p>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      <form aria-label="Empty pan return form" onSubmit={submit}>
        <label className="field">
          <span>Empty pans sent</span>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        </label>
        <button className="primary-button" type="submit">
          Send to lab
        </button>
      </form>
      {returns.length > 0 ? (
        <div className="list-stack">
          {returns.slice(0, 5).map((emptyReturn) => (
            <article className="list-row" key={emptyReturn.id}>
              <div>
                <strong>{emptyReturn.quantity} pans</strong>
                <span>{emptyReturn.status.replace("_", " ")}</span>
              </div>
              <span className="badge">{new Date(emptyReturn.sentAt).toLocaleDateString()}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
