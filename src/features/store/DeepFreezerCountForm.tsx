import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import type { StoreActor } from "./storeApi";
import { getDeepFreezerCount, listProjectedDeepFreezerBalances, submitDeepFreezerCount } from "./deepFreezerApi";

interface DeepFreezerCountFormProps extends StoreActor {
  title?: string;
  locationId: string;
  businessDate: string;
  flavours: Flavour[];
}

export function DeepFreezerCountForm({
  actorId,
  actorLocationId,
  actorRole,
  businessDate,
  flavours,
  locationId,
  title = "EOD deep freezer weights",
}: DeepFreezerCountFormProps) {
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [countStatus, setCountStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const staffLocked = Boolean(countStatus && actorRole === "store_staff");

  useEffect(() => {
    let mounted = true;

    async function loadWeights() {
      try {
        const [existing, projectedBalances] = await Promise.all([
          getDeepFreezerCount(locationId, businessDate),
          listProjectedDeepFreezerBalances(locationId),
        ]);
        if (!mounted) return;

        const sourceWeights = new Map(
          existing?.items.map((item) => [item.flavourId, item.weightKg]) ??
            projectedBalances.map((item) => [item.flavourId, item.currentWeightKg]),
        );
        setWeights(
          Object.fromEntries(flavours.map((flavour) => [flavour.id, String(sourceWeights.get(flavour.id) ?? 0)])),
        );
        setCountStatus(existing?.status ?? null);
        setError(null);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load deep freezer weights.");
        }
      }
    }

    void loadWeights();

    return () => {
      mounted = false;
    };
  }, [businessDate, flavours, locationId]);

  function updateWeight(flavourId: string, weightKg: string) {
    setWeights((current) => ({ ...current, [flavourId]: weightKg }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const submitted = await submitDeepFreezerCount({
        locationId,
        businessDate,
        notes: null,
        actorId,
        actorRole,
        actorLocationId,
        items: flavours.map((flavour) => ({
          flavourId: flavour.id,
          weightKg: Number(weights[flavour.id] || 0),
        })),
      });
      setCountStatus(submitted.status);
      setMessage(submitted.status === "corrected" ? "Deep freezer count corrected." : "Deep freezer count submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit deep freezer count.");
    }
  }

  return (
    <section className="card" id="deep-freezer-weights">
      <div className="card-title">{title}</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {countStatus ? (
        <p className="muted-copy">
          {businessDate}: <strong>{countStatus}</strong>
        </p>
      ) : null}
      <form aria-label={`${title} form`} onSubmit={submit}>
        <div className="list-stack" aria-label={title}>
          {flavours.map((flavour) => (
            <label className="inventory-count-row" key={flavour.id}>
              <span>
                <strong>{flavour.name}</strong>
                <small>Deep freezer total kg</small>
              </span>
              <input
                aria-label={`${flavour.name} deep freezer kg`}
                type="number"
                min="0"
                step="0.01"
                value={weights[flavour.id] ?? ""}
                onChange={(event) => updateWeight(flavour.id, event.target.value)}
                required
              />
            </label>
          ))}
        </div>
        <button className="primary-button" type="submit" disabled={flavours.length === 0 || staffLocked}>
          {countStatus ? "Update freezer count" : "Submit freezer count"}
        </button>
      </form>
      {flavours.length === 0 ? <p className="muted-copy">Add active flavours before counting deep freezer stock.</p> : null}
      {staffLocked ? <p className="muted-copy">Ask a Store Manager to correct today&apos;s freezer count.</p> : null}
    </section>
  );
}
