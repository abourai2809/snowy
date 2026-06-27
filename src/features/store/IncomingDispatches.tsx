import type { IncomingDispatch, IncomingPanReceiptDecisionStatus, IncomingPanReceiptStatus, StoreActor } from "./storeApi";
import { acceptIncomingDispatch, receiveIncomingDispatchPans } from "./storeApi";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import { useState } from "react";

interface IncomingDispatchesProps extends StoreActor {
  locationId: string;
  dispatches: IncomingDispatch[];
  rejectedDispatches?: IncomingDispatch[];
  flavours: Flavour[];
  onChanged: () => void;
}

function groupPansByFlavour(pans: Pan[], flavourById: Map<string, Flavour>) {
  const groups = new Map<string, { flavourName: string; pans: Pan[] }>();

  pans.forEach((pan) => {
    const flavourName = flavourById.get(pan.flavourId)?.name ?? "Unknown flavour";
    const group = groups.get(pan.flavourId) ?? { flavourName, pans: [] };
    group.pans.push(pan);
    groups.set(pan.flavourId, group);
  });

  return [...groups.values()]
    .map((group) => ({ ...group, pans: group.pans.sort((a, b) => a.panId.localeCompare(b.panId)) }))
    .sort((a, b) => a.flavourName.localeCompare(b.flavourName));
}

function statusLabel(status: IncomingPanReceiptStatus) {
  if (status === "accepted") return "Accepted";
  if (status === "missing") return "Missing";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

interface DispatchPanGroupsProps {
  dispatch: IncomingDispatch;
  flavourById: Map<string, Flavour>;
  savingKey: string | null;
  mode: "incoming" | "rejected";
  onDecision: (dispatch: IncomingDispatch, pan: Pan, status: IncomingPanReceiptDecisionStatus) => void;
}

function DispatchPanGroups({ dispatch, flavourById, savingKey, mode, onDecision }: DispatchPanGroupsProps) {
  const visiblePans = dispatch.pans.filter((pan) => {
    const status = dispatch.panReceiptStatusByPanId[pan.id] ?? "pending";
    return mode === "incoming" ? status === "pending" : status === "missing" || status === "rejected";
  });
  const groups = groupPansByFlavour(visiblePans, flavourById);

  return (
    <div className="incoming-pan-groups">
      {groups.map((group) => (
        <div className="incoming-flavour-group" key={group.flavourName}>
          <strong>{group.flavourName}</strong>
          <div className="incoming-pan-list">
            {group.pans.map((pan) => (
              <div className="incoming-pan-row" key={pan.id}>
                <span className="large-pan-id">{pan.panId}</span>
                <small>{statusLabel(dispatch.panReceiptStatusByPanId[pan.id] ?? "pending")}</small>
                {mode === "incoming" ? (
                  <div className="incoming-pan-actions">
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      disabled={savingKey !== null}
                      onClick={() => onDecision(dispatch, pan, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      disabled={savingKey !== null}
                      onClick={() => onDecision(dispatch, pan, "missing")}
                    >
                      Missing
                    </button>
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      disabled={savingKey !== null}
                      onClick={() => onDecision(dispatch, pan, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={savingKey !== null}
                    onClick={() => onDecision(dispatch, pan, "accepted")}
                  >
                    Accept pan
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));

  async function accept(dispatchId: string) {
    setSavingKey(`${dispatchId}:all`);
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
      setMessage("All pending pans accepted.");
      onChanged();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept dispatch.");
    } finally {
      setSavingKey(null);
    }
  }

  async function decidePan(dispatch: IncomingDispatch, pan: Pan, status: IncomingPanReceiptDecisionStatus) {
    setSavingKey(`${dispatch.id}:${pan.id}:${status}`);
    setError(null);
    setMessage(null);
    try {
      await receiveIncomingDispatchPans({
        dispatchId: dispatch.id,
        locationId,
        decisions: [{ panUuid: pan.id, status }],
        notes: `${pan.panId}: ${status}`,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage(`${pan.panId} marked ${status}.`);
      onChanged();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to update pan.");
    } finally {
      setSavingKey(null);
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
              <div className="dispatch-summary">
                <span className="dispatch-code">Dispatch {dispatch.dispatchCode}</span>
                <DispatchPanGroups
                  dispatch={dispatch}
                  flavourById={flavourById}
                  savingKey={savingKey}
                  mode="incoming"
                  onDecision={(item, pan, status) => void decidePan(item, pan, status)}
                />
              </div>
            <button
              className="secondary-button"
              type="button"
              disabled={savingKey !== null}
              onClick={() => void accept(dispatch.id)}
            >
              {savingKey === `${dispatch.id}:all` ? "Accepting..." : "Accept all"}
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
                <div className="dispatch-summary">
                  <span className="dispatch-code">Dispatch {dispatch.dispatchCode}</span>
                  <DispatchPanGroups
                    dispatch={dispatch}
                    flavourById={flavourById}
                    savingKey={savingKey}
                    mode="rejected"
                    onDecision={(item, pan, status) => void decidePan(item, pan, status)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
