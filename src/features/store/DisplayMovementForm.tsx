import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { isActiveDisplayAssignment, isPartialDeepFreezerPan } from "../../domain/pans";
import type { Pan } from "../../domain/pans";
import type { Flavour } from "../../domain/flavours";
import type { StoreActor } from "./storeApi";
import { swapPanToDisplay } from "./storeApi";

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
  const [flavourId, setFlavourId] = useState("");
  const [panUuid, setPanUuid] = useState("");
  const [checkoutMode, setCheckoutMode] = useState<"partial" | "empty">("partial");
  const [checkoutWeightKg, setCheckoutWeightKg] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flavourById = useMemo(() => new Map(flavours.map((flavour) => [flavour.id, flavour])), [flavours]);
  const candidatePans = useMemo(
    () => backupPans.filter((pan) => pan.flavourId === flavourId && !isActiveDisplayAssignment(pan)),
    [backupPans, flavourId],
  );
  const currentDisplayPan = displayPans.find((pan) => pan.flavourId === flavourId) ?? null;
  const canSubmit = Boolean(
    flavourId &&
      panUuid &&
      (!currentDisplayPan ||
        checkoutMode === "empty" ||
        checkoutWeightKg ||
        currentDisplayPan.currentWeightKg !== null),
  );

  function updateFlavour(flavourIdValue: string) {
    setFlavourId(flavourIdValue);
    setPanUuid("");
    setCheckoutMode("partial");
    setCheckoutWeightKg("");
  }

  useEffect(() => {
    setCheckoutMode("partial");
    setCheckoutWeightKg(
      currentDisplayPan?.currentWeightKg === null || currentDisplayPan?.currentWeightKg === undefined
        ? ""
        : String(currentDisplayPan.currentWeightKg),
    );
  }, [currentDisplayPan?.currentWeightKg, currentDisplayPan?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await swapPanToDisplay({
        panUuid,
        storeLocationId: locationId,
        checkoutPanUuid: currentDisplayPan?.id ?? null,
        checkoutWeightKg: currentDisplayPan
          ? checkoutMode === "empty"
            ? 0
            : Number(checkoutWeightKg || (currentDisplayPan.currentWeightKg ?? 0))
          : null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage(currentDisplayPan ? "Display pan swapped." : "Pan moved to display.");
      setFlavourId("");
      setPanUuid("");
      setCheckoutMode("partial");
      setCheckoutWeightKg("");
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
          <span>Flavour</span>
          <select value={flavourId} onChange={(event) => updateFlavour(event.target.value)} required>
            <option value="">Select flavour</option>
            {flavours.map((flavour) => (
              <option value={flavour.id} key={flavour.id}>
                {flavour.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Pan ID</span>
          <select value={panUuid} onChange={(event) => setPanUuid(event.target.value)} required disabled={!flavourId}>
            <option value="">Select deep freezer pan</option>
            {candidatePans.map((pan) => (
              <option value={pan.id} key={pan.id}>
                {flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"} - {pan.panId}
                {isPartialDeepFreezerPan(pan) ? " (partial deep)" : ""}
              </option>
            ))}
          </select>
        </label>

        {flavourId && candidatePans.length === 0 ? (
          <p className="muted-copy">No deep freezer pan IDs available for this flavour.</p>
        ) : null}

        {currentDisplayPan ? (
          <div className="list-row">
            <div>
              <strong>Current display pan</strong>
              <span>{currentDisplayPan.panId}</span>
              <span>{currentDisplayPan.status === "returned" ? "Returned to deep, still assigned" : "In display"}</span>
            </div>
            <label className="field compact-field">
              <span>Checkout</span>
              <select value={checkoutMode} onChange={(event) => setCheckoutMode(event.target.value as "partial" | "empty")}>
                <option value="partial">Partial</option>
                <option value="empty">Completely empty</option>
              </select>
            </label>
            {checkoutMode === "partial" ? (
              <label className="field compact-field">
                <span>Remaining kg</span>
                <input
                  aria-label={`Checkout weight ${currentDisplayPan.panId}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={checkoutWeightKg}
                  onChange={(event) => setCheckoutWeightKg(event.target.value)}
                  required
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <button className="primary-button" type="submit" disabled={!canSubmit}>
          {currentDisplayPan ? "Swap pan" : "Move pan"}
        </button>
      </form>
    </section>
  );
}
