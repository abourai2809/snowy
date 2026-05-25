import { useState, type FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import { URGENT_REQUIREMENT_TYPE_LABELS, type UrgentRequirementType } from "../../domain/urgentRequirements";
import type { StoreActor } from "../store/storeApi";
import { createUrgentRequirement } from "./urgentRequirementApi";

interface UrgentRequirementFormProps extends StoreActor {
  locationId: string;
  flavours: Flavour[];
  onCreated: () => void;
}

export function UrgentRequirementForm({
  actorId,
  actorLocationId,
  actorRole,
  flavours,
  locationId,
  onCreated,
}: UrgentRequirementFormProps) {
  const [requirementType, setRequirementType] = useState<UrgentRequirementType>("gelato");
  const [flavourId, setFlavourId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await createUrgentRequirement({
        sourceLocationId: locationId,
        requirementType,
        relatedFlavourId: requirementType === "gelato" ? flavourId || null : null,
        relatedCatalogItemId: null,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        priority: "urgent",
        message,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage("");
      setQuantity("");
      setSuccess("Urgent requirement sent.");
      onCreated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to send urgent requirement.");
    }
  }

  return (
    <section className="card" id="urgent-requirement">
      <div className="card-title">Urgent requirement</div>
      {success ? <div className="alert alert-success">{success}</div> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}
      <form className="staff-form" aria-label="Urgent requirement form" onSubmit={submit}>
        <label className="field">
          <span>Type</span>
          <select
            value={requirementType}
            onChange={(event) => setRequirementType(event.target.value as UrgentRequirementType)}
          >
            {Object.entries(URGENT_REQUIREMENT_TYPE_LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {requirementType === "gelato" ? (
          <label className="field">
            <span>Flavour</span>
            <select value={flavourId} onChange={(event) => setFlavourId(event.target.value)}>
              <option value="">Select flavour</option>
              {flavours.map((flavour) => (
                <option value={flavour.id} key={flavour.id}>
                  {flavour.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="compact-grid">
          <label className="field compact-field">
            <span>Qty</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="field compact-field">
            <span>Unit</span>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Details</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What is needed urgently?"
            required
          />
        </label>
        <button className="primary-button" type="submit">
          Send urgent requirement
        </button>
      </form>
    </section>
  );
}
