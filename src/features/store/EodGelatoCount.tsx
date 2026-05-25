import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EodCountWithItems, StoreActor } from "./storeApi";
import { getEodCount, submitEodGelatoCount } from "./storeApi";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";

interface EodEntry {
  id: string;
  panUuid: string | null;
  flavourId: string | null;
  weightKg: string;
}

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
  const [entries, setEntries] = useState<EodEntry[]>([]);
  const [count, setCount] = useState<EodCountWithItems | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const businessDate = todayDate();
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));
  const staffCorrectionLocked = count && actorRole === "store_staff";
  const displayFlavourIds = [...new Set(displayPans.map((pan) => pan.flavourId))];

  useEffect(() => {
    setEntries(
      displayPans.map((pan) => ({
        id: pan.id,
        panUuid: pan.id,
        flavourId: pan.flavourId,
        weightKg: pan.currentWeightKg === null ? "" : String(pan.currentWeightKg),
      })),
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
        items: entries.map((entry) => ({
          panUuid: entry.panUuid,
          flavourId: entry.flavourId,
          weightKg: Number(entry.weightKg),
        })),
      });
      setCount(submitted);
      setMessage(submitted.status === "corrected" ? "EOD count corrected." : "EOD count submitted.");
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit EOD count.");
    }
  }

  function addEntry() {
    setEntries((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        panUuid: null,
        flavourId: displayFlavourIds[0] ?? null,
        weightKg: "",
      },
    ]);
  }

  function removeEntry(entryId: string) {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  }

  function updateEntryChoice(entryId: string, value: string) {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;
        if (value.startsWith("pan:")) {
          const pan = displayPans.find((item) => item.id === value.slice(4));
          return { ...entry, panUuid: pan?.id ?? null, flavourId: pan?.flavourId ?? null };
        }

        return { ...entry, panUuid: null, flavourId: value.slice(8) || null };
      }),
    );
  }

  function updateEntryWeight(entryId: string, weightKg: string) {
    setEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, weightKg } : entry)));
  }

  return (
    <section className="card" id="eod-gelato-weights">
      <div className="card-title">EOD gelato weights</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {count ? (
        <p className="muted-copy">
          Today: <strong>{count.status}</strong>
        </p>
      ) : null}
      {displayPans.length === 0 ? <p className="muted-copy">No display flavours or pans to count. Move a pan to display first.</p> : null}
      <form aria-label="EOD gelato weight form" onSubmit={submit}>
        <div className="list-stack">
          {entries.map((entry) => (
            <div className="eod-weight-row" key={entry.id}>
              <label className="field compact-field">
                <span>Flavour or pan</span>
                <select
                  aria-label={`EOD gelato item ${entry.id}`}
                  value={entry.panUuid ? `pan:${entry.panUuid}` : `flavour:${entry.flavourId ?? ""}`}
                  onChange={(event) => updateEntryChoice(entry.id, event.target.value)}
                  required
                >
                  {displayPans.map((pan) => (
                    <option value={`pan:${pan.id}`} key={pan.id}>
                      {flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"} - {pan.panId}
                    </option>
                  ))}
                  {displayFlavourIds.map((flavourId) => (
                    <option value={`flavour:${flavourId}`} key={flavourId}>
                      {flavourById.get(flavourId)?.name ?? "Unknown flavour"} total
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact-field">
                <span>Weight kg</span>
                <input
                  aria-label={`EOD weight ${entry.panUuid ? displayPans.find((pan) => pan.id === entry.panUuid)?.panId : flavourById.get(entry.flavourId ?? "")?.name ?? "flavour"}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={entry.weightKg}
                  onChange={(event) => updateEntryWeight(entry.id, event.target.value)}
                  required
                />
              </label>
              {entries.length > 1 ? (
                <button className="danger-button" type="button" onClick={() => removeEntry(entry.id)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="action-row">
          <button className="secondary-button" type="button" onClick={addEntry} disabled={displayFlavourIds.length === 0}>
            Add gelato line
          </button>
          <button className="primary-button" type="submit" disabled={entries.length === 0 || Boolean(staffCorrectionLocked)}>
            {count ? "Update count" : "Submit count"}
          </button>
        </div>
      </form>
      {staffCorrectionLocked ? <p className="muted-copy">Ask a Store Manager to correct today&apos;s count.</p> : null}
    </section>
  );
}
