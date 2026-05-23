import type { IncomingDispatch, StoreActor } from "./storeApi";
import { acceptIncomingDispatch } from "./storeApi";
import type { Flavour } from "../../domain/flavours";
import { useState } from "react";

interface IncomingDispatchesProps extends StoreActor {
  locationId: string;
  dispatches: IncomingDispatch[];
  flavours: Flavour[];
  onChanged: () => void;
}

export function IncomingDispatches({
  actorId,
  actorLocationId,
  actorRole,
  locationId,
  dispatches,
  flavours,
  onChanged,
}: IncomingDispatchesProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));

  async function accept(dispatchId: string) {
    setSavingId(dispatchId);
    setError(null);
    setMessage(null);
    try {
      await acceptIncomingDispatch({
        dispatchId,
        locationId,
        notes: null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage("Dispatch accepted.");
      onChanged();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept dispatch.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="card">
      <div className="card-title">Incoming pans</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {dispatches.length === 0 ? <p className="muted-copy">No incoming dispatches.</p> : null}
      <div className="list-stack">
        {dispatches.map((dispatch) => (
          <article className="list-row vertical-row" key={dispatch.id}>
            <div>
              <strong>{dispatch.dispatchCode}</strong>
              <span>
                {dispatch.pans
                  .map((pan) => `${pan.panId} ${flavourById.get(pan.flavourId)?.name ?? "Unknown"}`)
                  .join(", ")}
              </span>
            </div>
            <button
              className="secondary-button"
              type="button"
              disabled={savingId === dispatch.id}
              onClick={() => void accept(dispatch.id)}
            >
              {savingId === dispatch.id ? "Accepting..." : "Accept"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
