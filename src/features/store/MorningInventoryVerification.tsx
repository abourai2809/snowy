import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  getDeepFreezerCount,
  listProjectedDeepFreezerBalances,
  MORNING_VERIFICATION_TOLERANCE_KG,
  submitDeepFreezerCount,
} from "./deepFreezerApi";
import type { StoreActor } from "./storeApi";
import type { DeepFreezerCountWithItems } from "../../domain/inventory";

interface MorningInventoryVerificationProps extends StoreActor {
  locationId: string;
  businessDate: string;
}

interface VerificationRow {
  flavourId: string;
  flavourName: string;
  expectedWeightKg: number;
  actualWeightKg: number;
  varianceKg: number | null;
}

export function MorningInventoryVerification({
  actorId,
  actorLocationId,
  actorRole,
  businessDate,
  locationId,
}: MorningInventoryVerificationProps) {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [count, setCount] = useState<DeepFreezerCountWithItems | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const staffLocked = Boolean(count && actorRole === "store_staff");
  const discrepancyCount = rows.filter((row) => row.varianceKg !== null && hasDiscrepancy(row.varianceKg)).length;

  useEffect(() => {
    let mounted = true;

    async function loadRows() {
      try {
        const [projectedBalances, existing] = await Promise.all([
          listProjectedDeepFreezerBalances(locationId),
          getDeepFreezerCount(locationId, businessDate, "morning"),
        ]);
        if (!mounted) return;

        const existingByFlavour = new Map(existing?.items.map((item) => [item.flavourId, item]) ?? []);
        const nextRows = projectedBalances.map((balance): VerificationRow => {
          const existingItem = existingByFlavour.get(balance.flavourId);
          const actualWeightKg = existingItem?.weightKg ?? balance.currentWeightKg;
          return {
            flavourId: balance.flavourId,
            flavourName: balance.flavourName,
            expectedWeightKg: balance.currentWeightKg,
            actualWeightKg,
            varianceKg:
              existingItem?.varianceKg ?? (existing ? roundVarianceKg(actualWeightKg - balance.currentWeightKg) : null),
          };
        });

        setRows(nextRows);
        setWeights(Object.fromEntries(nextRows.map((row) => [row.flavourId, String(row.actualWeightKg)])));
        setCount(existing);
        setError(null);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load morning inventory.");
      }
    }

    void loadRows();

    return () => {
      mounted = false;
    };
  }, [businessDate, locationId]);

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
        countType: "morning",
        notes: null,
        actorId,
        actorRole,
        actorLocationId,
        items: rows.map((row) => ({
          flavourId: row.flavourId,
          weightKg: Number(weights[row.flavourId] || 0),
        })),
      });
      const submittedByFlavour = new Map(submitted.items.map((item) => [item.flavourId, item]));
      const nextRows = rows.map((row): VerificationRow => {
        const item = submittedByFlavour.get(row.flavourId);
        const actualWeightKg = item?.weightKg ?? Number(weights[row.flavourId] || 0);
        return {
          ...row,
          actualWeightKg,
          expectedWeightKg: item?.expectedWeightKg ?? row.expectedWeightKg,
          varianceKg: item?.varianceKg ?? roundVarianceKg(actualWeightKg - row.expectedWeightKg),
        };
      });
      const nextDiscrepancyCount = nextRows.filter((row) => row.varianceKg !== null && hasDiscrepancy(row.varianceKg)).length;
      setRows(nextRows);
      setCount(submitted);
      setMessage(
        nextDiscrepancyCount === 0
          ? "Morning inventory verified."
          : `Morning check submitted with ${nextDiscrepancyCount} discrepancies.`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit morning inventory.");
    }
  }

  return (
    <section className="card" id="morning-inventory-check">
      <div className="card-title">Morning inventory check</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {count ? (
        <p className="muted-copy">
          {businessDate}: <strong>{count.status}</strong>
          {discrepancyCount > 0 ? ` / ${discrepancyCount} discrepancies` : " / verified"}
        </p>
      ) : null}
      {rows.length === 0 ? <p className="muted-copy">No active flavours found for morning verification.</p> : null}
      <form aria-label="Morning inventory verification form" onSubmit={submit}>
        <div className="list-stack">
          {rows.map((row) => {
            const liveVariance = roundVarianceKg(Number(weights[row.flavourId] || 0) - row.expectedWeightKg);
            const variance = row.varianceKg ?? liveVariance;
            return (
              <label className="inventory-count-row" key={row.flavourId}>
                <span>
                  <strong>{row.flavourName}</strong>
                  <small>
                    Expected {formatWeight(row.expectedWeightKg)} kg
                    {count ? ` / difference ${formatSignedWeight(variance)} kg` : null}
                  </small>
                </span>
                <input
                  aria-label={`Morning weight ${row.flavourName}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={weights[row.flavourId] ?? ""}
                  onChange={(event) => updateWeight(row.flavourId, event.target.value)}
                  required
                />
              </label>
            );
          })}
        </div>
        <button className="primary-button" type="submit" disabled={rows.length === 0 || staffLocked}>
          {count ? "Update morning check" : "Submit morning check"}
        </button>
      </form>
      {staffLocked ? <p className="muted-copy">Ask a Store Manager to correct today&apos;s morning check.</p> : null}
    </section>
  );
}

function hasDiscrepancy(varianceKg: number): boolean {
  return Math.abs(varianceKg) > MORNING_VERIFICATION_TOLERANCE_KG;
}

function roundVarianceKg(value: number): number {
  return Number(value.toFixed(3));
}

function formatWeight(value: number): string {
  return value.toFixed(2);
}

function formatSignedWeight(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}
