import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { InventoryCountWithItems } from "../../../domain/supplies";
import { useAuth } from "../../auth/AuthProvider";
import { listInventoryCounts } from "../../inventory/inventoryApi";
import { correctInventoryCountItem } from "./correctionsApi";

export function CorrectionsPage() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<InventoryCountWithItems[]>([]);
  const [quantityByKey, setQuantityByKey] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const rows = await listInventoryCounts();
    setCounts(rows);
    setQuantityByKey(
      Object.fromEntries(rows.flatMap((count) => count.items.map((item) => [`${count.id}:${item.catalogItemId}`, String(item.quantity)]))),
    );
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load corrections."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>, countId: string, catalogItemId: string) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const key = `${countId}:${catalogItemId}`;

    try {
      await correctInventoryCountItem({
        countId,
        catalogItemId,
        quantity: Number(quantityByKey[key]),
        correctedBy: profile?.id ?? null,
      });
      setMessage("Inventory count corrected.");
      await load();
    } catch (correctionError) {
      setError(correctionError instanceof Error ? correctionError.message : "Unable to correct count.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Corrections</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {counts.length === 0 ? <p className="muted-copy">No inventory counts to correct.</p> : null}
      <div className="list-stack">
        {counts.map((count) => (
          <article className="staff-row" key={count.id}>
            <div className="staff-row__head">
              <div>
                <strong>{count.locationId}</strong>
                <span>
                  {count.businessDate} / {count.scope} / {count.status}
                </span>
              </div>
            </div>
            <div className="list-stack">
              {count.items.map((item) => {
                const key = `${count.id}:${item.catalogItemId}`;
                return (
                  <form
                    className="correction-row"
                    aria-label={`Correct ${item.itemName}`}
                    key={key}
                    onSubmit={(event) => void submit(event, count.id, item.catalogItemId)}
                  >
                    <label className="field compact-field">
                      <span>{item.itemName}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantityByKey[key] ?? ""}
                        onChange={(event) =>
                          setQuantityByKey((current) => ({ ...current, [key]: event.target.value }))
                        }
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
