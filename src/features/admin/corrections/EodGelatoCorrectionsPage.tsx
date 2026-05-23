import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Flavour } from "../../../domain/flavours";
import type { EodCountItem } from "../../../domain/inventory";
import type { Pan } from "../../../domain/pans";
import { listFlavours } from "../../catalog/catalogApi";
import { useAuth } from "../../auth/AuthProvider";
import { listAllPans } from "../../lab/labApi";
import { correctEodGelatoCountItem, listEodGelatoCounts, type EodCountWithItems } from "../../store/storeApi";

export function EodGelatoCorrectionsPage() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<EodCountWithItems[]>([]);
  const [pans, setPans] = useState<Pan[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [weightByKey, setWeightByKey] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [countRows, panRows, flavourRows] = await Promise.all([
      listEodGelatoCounts(),
      listAllPans(),
      listFlavours(),
    ]);
    setCounts(countRows);
    setPans(panRows);
    setFlavours(flavourRows);
    setWeightByKey(
      Object.fromEntries(
        countRows.flatMap((count) =>
          count.items.map((item) => [`${count.id}:${item.id}`, item.weightKg === null ? "" : String(item.weightKg)]),
        ),
      ),
    );
  }

  useEffect(() => {
    load().catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Unable to load EOD gelato corrections."),
    );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>, countId: string, itemId: string) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const key = `${countId}:${itemId}`;

    try {
      await correctEodGelatoCountItem({
        countId,
        itemId,
        weightKg: Number(weightByKey[key]),
        correctedBy: profile?.id ?? null,
      });
      setMessage("EOD gelato count corrected.");
      await load();
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : "Unable to correct EOD gelato count.");
    }
  }

  const panById = new Map(pans.map((pan) => [pan.id, pan]));
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));

  function itemLabel(item: EodCountItem): string {
    const pan = item.panId ? panById.get(item.panId) : null;
    const flavour = flavourById.get(item.flavourId ?? pan?.flavourId ?? "");

    if (pan) {
      return `${pan.panId} ${flavour?.name ?? ""}`.trim();
    }

    if (flavour) {
      return `${flavour.name} total`;
    }

    return "Gelato line";
  }

  return (
    <section className="card">
      <div className="card-title">EOD gelato corrections</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {counts.length === 0 ? <p className="muted-copy">No EOD gelato counts to correct.</p> : null}
      <div className="list-stack">
        {counts.map((count) => (
          <article className="staff-row" key={count.id}>
            <div className="staff-row__head">
              <div>
                <strong>{count.locationId}</strong>
                <span>
                  {count.businessDate} / {count.status}
                </span>
              </div>
            </div>
            <div className="list-stack">
              {count.items.map((item) => {
                const key = `${count.id}:${item.id}`;
                return (
                  <form
                    className="correction-row"
                    aria-label={`Correct EOD ${itemLabel(item)}`}
                    key={key}
                    onSubmit={(event) => void submit(event, count.id, item.id)}
                  >
                    <label className="field compact-field">
                      <span>{itemLabel(item)}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={weightByKey[key] ?? ""}
                        onChange={(event) => setWeightByKey((current) => ({ ...current, [key]: event.target.value }))}
                        required
                      />
                    </label>
                    <button className="secondary-button" type="submit">
                      Correct
                    </button>
                  </form>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
