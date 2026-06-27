import { useEffect, useMemo, useState } from "react";
import { listStorePanInventoryRows, type StorePanInventoryRow } from "./storePanInventoryApi";

interface StorePanInventorySummaryProps {
  title?: string;
}

export function StorePanInventorySummary({ title = "Store pan inventory" }: StorePanInventorySummaryProps) {
  const [rows, setRows] = useState<StorePanInventoryRow[]>([]);
  const [storeId, setStoreId] = useState("");
  const [flavourId, setFlavourId] = useState("");
  const [backupThreshold, setBackupThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listStorePanInventoryRows()
      .then((inventoryRows) => {
        setRows(inventoryRows);
        setError(null);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load store pan inventory."),
      );
  }, []);

  const stores = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.storeId, { id: row.storeId, name: row.storeName }])).values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [rows],
  );
  const flavours = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.flavourId, { id: row.flavourId, name: row.flavourName }])).values()].sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    [rows],
  );
  const thresholdValue = backupThreshold === "" ? null : Number(backupThreshold);
  const filteredRows = rows.filter((row) => {
    if (storeId && row.storeId !== storeId) return false;
    if (flavourId && row.flavourId !== flavourId) return false;
    if (thresholdValue !== null && row.backupPanCount > thresholdValue) return false;
    return true;
  });

  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      <div className="compact-grid">
        <label className="field compact-field">
          <span>Store</span>
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="Inventory store">
            <option value="">All stores</option>
            {stores.map((store) => (
              <option value={store.id} key={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact-field">
          <span>Flavour</span>
          <select value={flavourId} onChange={(event) => setFlavourId(event.target.value)} aria-label="Inventory flavour">
            <option value="">All flavours</option>
            {flavours.map((flavour) => (
              <option value={flavour.id} key={flavour.id}>
                {flavour.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact-field">
          <span>New backup pans at or below</span>
          <input
            aria-label="Backup pan threshold"
            type="number"
            min="0"
            step="1"
            value={backupThreshold}
            onChange={(event) => setBackupThreshold(event.target.value)}
            placeholder="Any"
          />
        </label>
      </div>
      {filteredRows.length === 0 ? <p className="muted-copy">No store pan inventory rows match these filters.</p> : null}
      {filteredRows.length > 0 ? (
        <div className="review-table-wrap">
          <table className="review-table store-pan-inventory-table" aria-label="Store pan inventory">
            <thead>
              <tr>
                <th>Store</th>
                <th>Flavour</th>
                <th>New backup pans</th>
                <th>Open/partial pans</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isLow = thresholdValue !== null && row.backupPanCount <= thresholdValue;
                return (
                  <tr key={`${row.storeId}:${row.flavourId}`}>
                    <td>
                      <strong>{row.storeName}</strong>
                      <small>{row.storeId}</small>
                    </td>
                    <td>
                      <strong>{row.flavourName}</strong>
                    </td>
                    <td>{row.backupPanCount}</td>
                    <td>{row.openPanCount}</td>
                    <td>
                      <span className={`badge ${isLow ? "badge-warning" : ""}`}>{isLow ? "low backup" : "ok"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
