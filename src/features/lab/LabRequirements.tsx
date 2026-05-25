import { useEffect, useState } from "react";
import type { StoreGelatoRequirement } from "../../domain/inventory";
import { listStoreGelatoRequirements } from "../store/deepFreezerApi";

export function LabRequirements() {
  const [requirements, setRequirements] = useState<StoreGelatoRequirement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listStoreGelatoRequirements()
      .then((rows) => {
        setRequirements(rows);
        setError(null);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load store requirements."),
      );
  }, []);

  return (
    <section className="card">
      <div className="card-title">Store gelato requirements</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {requirements.length === 0 ? <p className="muted-copy">No store target gaps yet.</p> : null}
      <div className="list-stack">
        {requirements.slice(0, 12).map((requirement) => (
          <div className="list-row" key={requirement.id}>
            <div>
              <strong>{requirement.flavourName}</strong>
              <span>
                {requirement.locationName}: {requirement.currentWeightKg} / {requirement.targetWeightKg} kg
              </span>
            </div>
            <span className="badge">{requirement.neededWeightKg.toFixed(2)} kg</span>
          </div>
        ))}
      </div>
    </section>
  );
}
