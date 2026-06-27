import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EodCountWithItems, EodDisplayPanRow, StoreActor } from "./storeApi";
import { getEodCount, listEodDisplayPanRows, submitEodGelatoCount } from "./storeApi";
import type { Flavour } from "../../domain/flavours";

interface EodEntry {
  id: string;
  panUuid: string;
  flavourId: string;
  panId: string;
  openingWeightKg: number;
  lockedEmpty: boolean;
  weightKg: string;
}

interface EodGelatoCountProps extends StoreActor {
  locationId: string;
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

  useEffect(() => {
    let mounted = true;

    async function loadRows() {
      try {
        const [existing, displayRows] = await Promise.all([
          getEodCount(locationId, businessDate),
          listEodDisplayPanRows(locationId, businessDate),
        ]);
        if (!mounted) return;

        const existingWeightsByPanId = new Map<string, number>();
        existing?.items.forEach((item) => {
          if (!item.panId) return;
          existingWeightsByPanId.set(item.panId, item.weightKg ?? 0);
        });

        const flavourName = (flavourId: string) => flavourById.get(flavourId)?.name ?? "";
        const entries = displayRows
          .map((row: EodDisplayPanRow): EodEntry => ({
            id: row.pan.id,
            panUuid: row.pan.id,
            flavourId: row.pan.flavourId,
            panId: row.pan.panId,
            openingWeightKg: row.openingWeightKg,
            lockedEmpty: row.lockedEmpty && !existingWeightsByPanId.has(row.pan.id),
            weightKg: String(existingWeightsByPanId.get(row.pan.id) ?? (row.lockedEmpty ? 0 : row.pan.currentWeightKg ?? row.openingWeightKg)),
          }))
          .sort((a, b) => {
            const flavourSort = flavourName(a.flavourId).localeCompare(flavourName(b.flavourId));
            if (flavourSort !== 0) return flavourSort;
            return a.panId.localeCompare(b.panId);
          });

        setEntries(entries);
        setCount(existing);
        setError(null);
      } catch (countError) {
        if (mounted) setError(countError instanceof Error ? countError.message : "Unable to load EOD count.");
      }
    }

    void loadRows();

    return () => {
      mounted = false;
    };
  }, [businessDate, flavours, locationId]);

  function validateEntries(): string | null {
    for (const entry of entries) {
      const weightKg = Number(entry.weightKg);
      if (entry.lockedEmpty && weightKg !== 0) {
        return `${entry.panId} is already marked empty. Keep its EOD weight at 0 kg.`;
      }
      if (weightKg > entry.openingWeightKg) {
        return `${entry.panId} cannot be higher than opening weight (${entry.openingWeightKg} kg).`;
      }
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateEntries();
    if (validationError) {
      setError(validationError);
      return;
    }

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
      setMessage(submitted.status === "corrected" ? "EOD weight corrected." : "EOD weight submitted.");
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit EOD count.");
    }
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
      {entries.length === 0 ? <p className="muted-copy">No display pans found for today.</p> : null}
      <form aria-label="EOD gelato weight form" onSubmit={submit}>
        <div className="list-stack">
          {entries.map((entry) => {
            const flavourName = flavourById.get(entry.flavourId)?.name ?? "Unknown flavour";
            return (
              <label className="inventory-count-row" key={entry.id}>
                <span>
                  <strong>{flavourName}</strong>
                  <small>{entry.panId}</small>
                  <small>Opening {entry.openingWeightKg} kg</small>
                </span>
                <input
                  aria-label={`EOD weight ${flavourName} ${entry.panId}`}
                  type="number"
                  min="0"
                  max={entry.openingWeightKg}
                  step="0.01"
                  value={entry.weightKg}
                  onChange={(event) => updateEntryWeight(entry.id, event.target.value)}
                  disabled={entry.lockedEmpty || Boolean(staffCorrectionLocked)}
                  required
                />
              </label>
            );
          })}
        </div>
        <div className="action-row">
          <button className="primary-button" type="submit" disabled={entries.length === 0 || Boolean(staffCorrectionLocked)}>
            {count ? "Update weight" : "Submit weight"}
          </button>
        </div>
      </form>
      {staffCorrectionLocked ? <p className="muted-copy">Ask a Store Manager to correct today&apos;s count.</p> : null}
    </section>
  );
}
