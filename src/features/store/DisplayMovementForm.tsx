import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { FillState } from "../../domain/inventory";
import { isPartialDeepFreezerPan } from "../../domain/pans";
import type { Pan } from "../../domain/pans";
import type { Flavour } from "../../domain/flavours";
import type { StoreActor } from "./storeApi";
import { checkoutDisplayPan, movePanToDisplay } from "./storeApi";

interface DisplayMovementFormProps extends StoreActor {
  locationId: string;
  backupPans: Pan[];
  displayPans: Pan[];
  flavours: Flavour[];
  onChanged: () => void;
}

export function DisplayMovementForm({
  actorId,
  actorLocationId,
  actorRole,
  backupPans,
  displayPans,
  flavours,
  locationId,
  onChanged,
}: DisplayMovementFormProps) {
  const [panUuid, setPanUuid] = useState("");
  const [fillState, setFillState] = useState<FillState>("full");
  const [weightKg, setWeightKg] = useState("");
  const [checkoutWeights, setCheckoutWeights] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flavourById = useMemo(() => new Map(flavours.map((flavour) => [flavour.id, flavour])), [flavours]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await movePanToDisplay({
        panUuid,
        storeLocationId: locationId,
        fillState,
        weightKg: fillState === "partial" ? Number(weightKg) : null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage("Pan moved to display.");
      setPanUuid("");
      setWeightKg("");
      setFillState("full");
      onChanged();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to move pan.");
    }
  }

  async function checkout(pan: Pan) {
    setError(null);
    setMessage(null);

    try {
      await checkoutDisplayPan({
        panUuid: pan.id,
        storeLocationId: locationId,
        weightKg: Number(checkoutWeights[pan.id] ?? pan.currentWeightKg ?? 0),
        actorId,
        actorRole,
        actorLocationId,
      });
      setCheckoutWeights((current) => {
        const { [pan.id]: _removed, ...rest } = current;
        return rest;
      });
      setMessage("Display pan checked out.");
      onChanged();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to check out display pan.");
    }
  }

  function updateCheckoutWeight(panId: string, value: string) {
    setCheckoutWeights((current) => ({ ...current, [panId]: value }));
  }

  return (
    <section className="card">
      <div className="card-title">Move to display</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {displayPans.length > 0 ? (
        <div className="list-stack">
          {displayPans.map((pan) => (
            <article className="list-row" key={pan.id}>
              <div>
                <strong>{flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"}</strong>
                <span>{pan.panId}</span>
                <span>{pan.status === "returned" ? "Returned to deep, still assigned" : "In display"}</span>
              </div>
              <label className="field compact-field">
                <span>Checkout kg</span>
                <input
                  aria-label={`Checkout weight ${pan.panId}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={checkoutWeights[pan.id] ?? String(pan.currentWeightKg ?? "")}
                  onChange={(event) => updateCheckoutWeight(pan.id, event.target.value)}
                />
              </label>
              <button className="secondary-button" type="button" onClick={() => checkout(pan)}>
                Check out
              </button>
            </article>
          ))}
        </div>
      ) : null}
      <form aria-label="Display movement form" onSubmit={submit}>
        <label className="field">
          <span>Pan ID</span>
          <select value={panUuid} onChange={(event) => setPanUuid(event.target.value)} required>
            <option value="">Select deep freezer pan</option>
            {backupPans.map((pan) => (
              <option value={pan.id} key={pan.id}>
                {flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"} - {pan.panId}
                {isPartialDeepFreezerPan(pan) ? " (partial deep)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Pan state</span>
          <select value={fillState} onChange={(event) => setFillState(event.target.value as FillState)}>
            <option value="full">Full</option>
            <option value="partial">Partial</option>
          </select>
        </label>
        {fillState === "partial" ? (
          <label className="field">
            <span>Current weight kg</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              required
            />
          </label>
        ) : null}
        <button className="primary-button" type="submit" disabled={!panUuid}>
          Move pan
        </button>
      </form>
    </section>
  );
}
