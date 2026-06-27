import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { isActiveDisplayAssignment, isPartialDeepFreezerPan } from "../../domain/pans";
import type { Pan } from "../../domain/pans";
import type { Flavour } from "../../domain/flavours";
import type { StoreActor } from "./storeApi";
import { swapPanToDisplay } from "./storeApi";

type CheckoutMode = "partial" | "empty" | "too_low";

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
  const [fifoOverride, setFifoOverride] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("partial");
  const [checkoutWeightKg, setCheckoutWeightKg] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flavourById = useMemo(() => new Map(flavours.map((flavour) => [flavour.id, flavour])), [flavours]);
  const candidatePans = useMemo(
    () => backupPans.filter((pan) => pan.flavourId === flavourId && !isActiveDisplayAssignment(pan)),
    [backupPans, flavourId],
  );
  const recommendedPan = candidatePans[0] ?? null;
  const selectedPanUuid = fifoOverride ? panUuid : recommendedPan?.id ?? "";
  const selectedOverridePan = candidatePans.find((pan) => pan.id === panUuid) ?? null;
  const isFifoOverride = Boolean(fifoOverride && recommendedPan && panUuid && panUuid !== recommendedPan.id);
  const currentDisplayPan = displayPans.find((pan) => pan.flavourId === flavourId) ?? null;
  const canSubmit = Boolean(
    flavourId &&
      selectedPanUuid &&
      (!currentDisplayPan ||
        checkoutMode === "empty" ||
        checkoutMode === "too_low" ||
        checkoutWeightKg ||
        currentDisplayPan.currentWeightKg !== null),
  );

  function updateFlavour(flavourIdValue: string) {
    setFlavourId(flavourIdValue);
    setPanUuid("");
    setFifoOverride(false);
    setCheckoutMode("partial");
    setCheckoutWeightKg("");
  }

  function toggleFifoOverride() {
    setPanUuid("");
    setFifoOverride((current) => !current);
  }

  useEffect(() => {
    setCheckoutMode("partial");
    setCheckoutWeightKg(
      currentDisplayPan?.currentWeightKg === null || currentDisplayPan?.currentWeightKg === undefined
        ? ""
        : String(currentDisplayPan.currentWeightKg),
    );
  }, [currentDisplayPan?.currentWeightKg, currentDisplayPan?.id]);

  useEffect(() => {
    if (!fifoOverride) return;
    if (panUuid && !candidatePans.some((pan) => pan.id === panUuid)) {
      setPanUuid("");
    }
  }, [candidatePans, fifoOverride, panUuid]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await swapPanToDisplay({
        panUuid: selectedPanUuid,
        storeLocationId: locationId,
        checkoutPanUuid: currentDisplayPan?.id ?? null,
        checkoutWeightKg: currentDisplayPan
          ? checkoutMode === "empty" || checkoutMode === "too_low"
            ? 0
            : Number(checkoutWeightKg || (currentDisplayPan.currentWeightKg ?? 0))
          : null,
        fifoOverride: isFifoOverride,
        recommendedPanUuid: recommendedPan?.id ?? null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage(currentDisplayPan ? "Display pan swapped." : "Pan moved to display.");
      setFlavourId("");
      setPanUuid("");
      setFifoOverride(false);
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
        {recommendedPan ? (
          <div className="recommended-pan-card">
            <span>Recommended FIFO pan</span>
            <strong>{recommendedPan.panId}</strong>
            {isPartialDeepFreezerPan(recommendedPan) ? <small>Partial pan in deep freezer</small> : <small>Oldest pan first</small>}
          </div>
        ) : null}

        {flavourId && candidatePans.length === 0 ? (
          <p className="muted-copy">No deep freezer pan IDs available for this flavour.</p>
        ) : null}

        {recommendedPan ? (
          <div className="override-panel">
            <button className="secondary-button" type="button" onClick={toggleFifoOverride}>
              {fifoOverride ? "Use FIFO pan" : "Override FIFO"}
            </button>
            {fifoOverride ? (
              <>
                <label className="field compact-field">
                  <span>Override pan ID</span>
                  <select value={panUuid} onChange={(event) => setPanUuid(event.target.value)} required>
                    <option value="">Choose another pan</option>
                    {candidatePans.map((pan) => (
                      <option value={pan.id} key={pan.id}>
                        {pan.panId}
                        {pan.id === recommendedPan.id ? " (FIFO)" : ""}
                        {isPartialDeepFreezerPan(pan) ? " (partial)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedOverridePan && selectedOverridePan.id !== recommendedPan.id ? (
                  <div className="alert alert-danger">
                    This is not FIFO. Use this only if a manager told you to.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
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
              <select value={checkoutMode} onChange={(event) => setCheckoutMode(event.target.value as CheckoutMode)}>
                <option value="too_low">Too low, mark empty</option>
                <option value="empty">Completely empty</option>
                <option value="partial">Keep as partial</option>
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
