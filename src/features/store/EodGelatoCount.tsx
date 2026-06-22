import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EodCountWithItems, StoreActor } from "./storeApi";
import { getEodCount, submitEodGelatoCount } from "./storeApi";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import { listProjectedDeepFreezerBalances } from "./deepFreezerApi";

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

  useEffect(() => {
    let mounted = true;

    async function loadRows() {
      try {
        const [existing, projectedBalances] = await Promise.all([
          getEodCount(locationId, businessDate),
          listProjectedDeepFreezerBalances(locationId),
        ]);
        if (!mounted) return;

        const existingWeightsByFlavour = new Map<string, number>();
        existing?.items.forEach((item) => {
          const itemFlavourId = item.flavourId ?? displayPans.find((pan) => pan.id === item.panId)?.flavourId ?? null;
          if (!itemFlavourId) return;
          existingWeightsByFlavour.set(itemFlavourId, (existingWeightsByFlavour.get(itemFlavourId) ?? 0) + (item.weightKg ?? 0));
        });
        const displayFlavourIds = new Set(displayPans.map((pan) => pan.flavourId));
        const relevantFlavourIds = new Set(
          projectedBalances.filter((balance) => balance.currentWeightKg > 0).map((balance) => balance.flavourId),
        );
        existing?.items.forEach((item) => {
          if (item.flavourId) relevantFlavourIds.add(item.flavourId);
        });
        displayFlavourIds.forEach((flavourId) => relevantFlavourIds.add(flavourId));
        const displayEntries = [...displayFlavourIds].map((flavourId): EodEntry => {
          const displayWeightKg = displayPans
            .filter((pan) => pan.flavourId === flavourId)
            .reduce((sum, pan) => sum + (pan.currentWeightKg ?? 0), 0);
          return {
            id: `display-flavour:${flavourId}`,
            panUuid: null,
            flavourId,
            weightKg: String(existingWeightsByFlavour.get(flavourId) ?? displayWeightKg),
          };
        });
        const flavourEntries = [...relevantFlavourIds]
          .filter((flavourId) => !displayFlavourIds.has(flavourId))
          .map((flavourId): EodEntry => ({
            id: `flavour:${flavourId}`,
            panUuid: null,
            flavourId,
            weightKg: String(existingWeightsByFlavour.get(flavourId) ?? 0),
          }));
        const flavourName = (flavourId: string | null) => flavourById.get(flavourId ?? "")?.name ?? "";

        setEntries(
          [...displayEntries, ...flavourEntries].sort((a, b) =>
            flavourName(a.flavourId).localeCompare(flavourName(b.flavourId)),
          ),
        );
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
  }, [businessDate, displayPans, flavours, locationId]);

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

  function updateEntryWeight(entryId: string, weightKg: string) {
    setEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, weightKg } : entry)));
  }

  function getEntryLabel(entry: EodEntry) {
    const displayCount = displayPans.filter((item) => item.flavourId === entry.flavourId).length;
    return {
      name: flavourById.get(entry.flavourId ?? "")?.name ?? "Unknown flavour",
      detail: displayCount > 0 ? `${displayCount} display pan${displayCount === 1 ? "" : "s"}` : "No display pan recorded",
    };
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
      {entries.length === 0 ? <p className="muted-copy">No relevant gelato stock found for today.</p> : null}
      <form aria-label="EOD gelato weight form" onSubmit={submit}>
        <div className="list-stack">
          {entries.map((entry) => {
            const label = getEntryLabel(entry);
            return (
              <label className="inventory-count-row" key={entry.id}>
                <span>
                  <strong>{label.name}</strong>
                  <small>{label.detail}</small>
                </span>
                <input
                  aria-label={`EOD weight ${label.name}${entry.panUuid ? ` ${label.detail}` : ""}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={entry.weightKg}
                  onChange={(event) => updateEntryWeight(entry.id, event.target.value)}
                  required
                />
              </label>
            );
          })}
        </div>
        <div className="action-row">
          <button className="primary-button" type="submit" disabled={entries.length === 0 || Boolean(staffCorrectionLocked)}>
            {count ? "Update count" : "Submit count"}
          </button>
        </div>
      </form>
      {staffCorrectionLocked ? <p className="muted-copy">Ask a Store Manager to correct today&apos;s count.</p> : null}
    </section>
  );
}
