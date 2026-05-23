import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { CatalogItemKind } from "../../domain/catalog";
import type { InventoryChecklistItem, InventoryCountWithItems, InventoryScope } from "../../domain/supplies";
import type { InventoryActor } from "./inventoryApi";
import { listInventoryChecklist, listInventoryCounts, submitInventoryCount } from "./inventoryApi";

interface InventoryChecklistProps extends InventoryActor {
  title: string;
  locationId: string;
  scope: InventoryScope;
  kinds?: CatalogItemKind[];
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InventoryChecklist({
  actorId,
  actorLocationId,
  actorRole,
  kinds,
  locationId,
  scope,
  title,
}: InventoryChecklistProps) {
  const [checklist, setChecklist] = useState<InventoryChecklistItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [count, setCount] = useState<InventoryCountWithItems | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const businessDate = todayDate();
  const staffLocked = count && (actorRole === "store_staff" || actorRole === "lab_staff");

  useEffect(() => {
    let mounted = true;
    Promise.all([listInventoryChecklist(scope, kinds), listInventoryCounts(scope)])
      .then(([items, counts]) => {
        if (!mounted) return;
        setChecklist(items);
        setQuantities(Object.fromEntries(items.map((item) => [item.catalogItem.id, ""])));
        setCount(
          counts.find((item) => item.locationId === locationId && item.businessDate === businessDate) ?? null,
        );
      })
      .catch((loadError) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load inventory checklist.");
      });

    return () => {
      mounted = false;
    };
  }, [businessDate, kinds, locationId, scope]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const submitted = await submitInventoryCount({
        locationId,
        businessDate,
        scope,
        notes: null,
        actorId,
        actorRole,
        actorLocationId,
        items: checklist.map((item) => ({
          catalogItemId: item.catalogItem.id,
          quantity: Number(quantities[item.catalogItem.id]),
        })),
      });
      setCount(submitted);
      setMessage(submitted.status === "corrected" ? "Inventory count corrected." : "Inventory count submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit inventory count.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {count ? (
        <p className="muted-copy">
          Today: <strong>{count.status}</strong>
        </p>
      ) : null}
      <form aria-label={`${title} form`} onSubmit={submit}>
        <div className="list-stack" aria-label={title}>
          {checklist.map((item) => (
            <label className="inventory-count-row" key={item.catalogItem.id}>
              <span>
                <strong>{item.catalogItem.name}</strong>
                <small>
                  {item.unit} / min {item.defaultMinQty}
                </small>
              </span>
              <input
                aria-label={`${item.catalogItem.name} quantity`}
                type="number"
                min="0"
                step="0.01"
                value={quantities[item.catalogItem.id] ?? ""}
                onChange={(event) =>
                  setQuantities((current) => ({ ...current, [item.catalogItem.id]: event.target.value }))
                }
                required
              />
            </label>
          ))}
        </div>
        <button className="primary-button" type="submit" disabled={checklist.length === 0 || Boolean(staffLocked)}>
          {count ? "Update count" : "Submit count"}
        </button>
      </form>
      {checklist.length === 0 ? <p className="muted-copy">No active catalog items to count.</p> : null}
      {staffLocked ? <p className="muted-copy">Ask a manager to correct today&apos;s inventory count.</p> : null}
    </section>
  );
}
