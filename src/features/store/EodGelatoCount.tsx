import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EodCountWithItems, StoreActor } from "./storeApi";
import { getEodCount, submitEodGelatoCount } from "./storeApi";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";

interface EodGelatoCountProps extends StoreActor {
  locationId: string;
  displayPans: Pan[];
  flavours: Flavour[];
  onChanged: () => void;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EodGelatoCount({
  actorId,
  actorLocationId,
  actorRole,
  displayPans,
  flavours,
  locationId,
  onChanged,
}: EodGelatoCountProps) {
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [count, setCount] = useState<EodCountWithItems | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const businessDate = todayDate();
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));
  const staffCorrectionLocked = count && actorRole === "store_staff";

  useEffect(() => {
    setWeights(
      Object.fromEntries(
        displayPans.map((pan) => [pan.id, pan.currentWeightKg === null ? "" : String(pan.currentWeightKg)]),
      ),
    );
  }, [displayPans]);

  useEffect(() => {
    let mounted = true;
    getEodCount(locationId, businessDate)
      .then((existing) => {
        if (mounted) setCount(existing);
      })
      .catch((countError) => {
        if (mounted) setError(countError instanceof Error ? countError.message : "Unable to load EOD count.");
      });

    return () => {
      mounted = false;
    };
  }, [businessDate, locationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const submitted = await submitEodGelatoCount({
        locationId,
        businessDate,
        notes: null,
        actorId,
        actorRole,
        actorLocationId,
        items: displayPans.map((pan) => ({
          panUuid: pan.id,
          weightKg: Number(weights[pan.id]),
        })),
      });
      setCount(submitted);
      setMessage(submitted.status === "corrected" ? "EOD count corrected." : "EOD count submitted.");
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit EOD count.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">End of day</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {count ? (
        <p className="muted-copy">
          Today: <strong>{count.status}</strong>
        </p>
      ) : null}
      {displayPans.length === 0 ? <p className="muted-copy">No display pans to count.</p> : null}
      <form aria-label="EOD gelato count form" onSubmit={submit}>
        <div className="list-stack">
          {displayPans.map((pan) => (
            <label className="field compact-field" key={pan.id}>
              <span>
                {pan.panId} {flavourById.get(pan.flavourId)?.name ?? ""}
              </span>
              <input
                aria-label={`EOD weight ${pan.panId}`}
                type="number"
                min="0"
                step="0.01"
                value={weights[pan.id] ?? ""}
                onChange={(event) => setWeights((current) => ({ ...current, [pan.id]: event.target.value }))}
                required
              />
            </label>
          ))}
        </div>
        <button className="primary-button" type="submit" disabled={displayPans.length === 0 || Boolean(staffCorrectionLocked)}>
          {count ? "Update count" : "Submit count"}
        </button>
      </form>
      {staffCorrectionLocked ? <p className="muted-copy">Ask a Store Manager to correct today&apos;s count.</p> : null}
    </section>
  );
}
