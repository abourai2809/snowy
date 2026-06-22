import { useEffect, useState } from "react";
import type { EmptyPanReturn } from "../../domain/inventory";
import { acceptEmptyPanReturn, disputeEmptyPanReturn, listEmptyPanReturns } from "../store/storeApi";
import type { StaffProfile } from "../../domain/roles";

interface EmptyPanReturnsPanelProps {
  profile: StaffProfile;
}

export function EmptyPanReturnsPanel({ profile }: EmptyPanReturnsPanelProps) {
  const [returns, setReturns] = useState<EmptyPanReturn[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setReturns(await listEmptyPanReturns("in_transit"));
  }

  useEffect(() => {
    void load();
  }, []);

  async function resolve(returnId: string, action: "accept" | "dispute") {
    setSavingId(returnId);
    setError(null);
    setMessage(null);
    try {
      const input = {
        returnId,
        notes: action === "accept" ? "Received by lab." : "Disputed by lab.",
        actorId: profile.id,
        actorRole: profile.role,
        actorLocationId: profile.defaultLocationId,
      };
      if (action === "accept") {
        await acceptEmptyPanReturn(input);
        setMessage("Empty pan return accepted.");
      } else {
        await disputeEmptyPanReturn(input);
        setMessage("Empty pan return disputed.");
      }
      await load();
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : "Unable to resolve empty pan return.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="card">
      <div className="card-title">Incoming empty pans</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {returns.length === 0 ? <p className="muted-copy">No empty pan returns in transit.</p> : null}
      <div className="list-stack">
        {returns.map((emptyReturn) => (
          <article className="list-row vertical-row" key={emptyReturn.id}>
            <div>
              <strong>{emptyReturn.quantity} empty pans</strong>
              <span>From {emptyReturn.sourceLocationId}</span>
            </div>
            <div className="action-row">
              <button
                className="secondary-button"
                type="button"
                disabled={savingId === emptyReturn.id}
                onClick={() => void resolve(emptyReturn.id, "accept")}
              >
                Accept
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={savingId === emptyReturn.id}
                onClick={() => void resolve(emptyReturn.id, "dispute")}
              >
                Dispute
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
