import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { FillState } from "../../domain/inventory";
import type { Pan } from "../../domain/pans";
import type { Flavour } from "../../domain/flavours";
import type { StoreActor } from "./storeApi";
import { movePanToDisplay } from "./storeApi";

interface DisplayMovementFormProps extends StoreActor {
  locationId: string;
  backupPans: Pan[];
  flavours: Flavour[];
  onChanged: () => void;
}

export function DisplayMovementForm({
  actorId,
  actorLocationId,
  actorRole,
  backupPans,
  flavours,
  locationId,
  onChanged,
}: DisplayMovementFormProps) {
  const [panUuid, setPanUuid] = useState("");
  const [fillState, setFillState] = useState<FillState>("full");
  const [weightKg, setWeightKg] = useState("");
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

  return (
    <section className="card">
      <div className="card-title">Move to display</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      <form aria-label="Display movement form" onSubmit={submit}>
        <label className="field">
          <span>Pan ID</span>
          <select value={panUuid} onChange={(event) => setPanUuid(event.target.value)} required>
            <option value="">Select backup pan</option>
            {backupPans.map((pan) => (
              <option value={pan.id} key={pan.id}>
                {pan.panId} - {flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"}
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
