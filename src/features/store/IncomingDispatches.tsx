import type { IncomingDispatch, StoreActor } from "./storeApi";
import { acceptIncomingDispatch, overturnRejectedDispatch, rejectIncomingDispatch } from "./storeApi";
import type { Flavour } from "../../domain/flavours";
import { useState } from "react";

interface IncomingDispatchesProps extends StoreActor {
  locationId: string;
  dispatches: IncomingDispatch[];
  rejectedDispatches?: IncomingDispatch[];
  flavours: Flavour[];
  onChanged: () => void;
}

export function IncomingDispatches({
  actorId,
  actorLocationId,
  actorRole,
  locationId,
  dispatches,
  rejectedDispatches = [],
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

  async function reject(dispatchId: string) {
    setSavingId(dispatchId);
    setError(null);
    setMessage(null);
    try {
      await rejectIncomingDispatch({
        dispatchId,
        locationId,
        notes: "Rejected by store.",
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage("Dispatch rejected.");
      onChanged();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Unable to reject dispatch.");
    } finally {
      setSavingId(null);
    }
  }

  async function overturn(dispatchId: string) {
    setSavingId(dispatchId);
    setError(null);
    setMessage(null);
    try {
      await overturnRejectedDispatch({
        dispatchId,
        locationId,
        notes: "Rejection overturned by store.",
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage("Rejection overturned and dispatch accepted.");
      onChanged();
    } catch (overturnError) {
      setError(overturnError instanceof Error ? overturnError.message : "Unable to overturn rejection.");
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
            <button
              className="secondary-button"
              type="button"
              disabled={savingId === dispatch.id}
              onClick={() => void reject(dispatch.id)}
            >
              Reject
            </button>
          </article>
        ))}
      </div>
      {rejectedDispatches.length > 0 ? (
        <>
          <div className="card-title">Rejected pans</div>
          <div className="list-stack">
            {rejectedDispatches.map((dispatch) => (
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
                  onClick={() => void overturn(dispatch.id)}
                >
                  Accept rejected dispatch
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
