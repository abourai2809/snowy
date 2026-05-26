import { useState, type FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import type { QueueBusterJobType } from "../../domain/queueBuster";
import { useAuth } from "../auth/AuthProvider";
import { createQueueBusterJob } from "../queuebuster/queueBusterJobsApi";
import { removeFlavour, saveFlavour, setFlavourActive } from "./catalogApi";

interface FlavourEditorProps {
  flavours: Flavour[];
  onChanged: () => Promise<void>;
}

const emptyForm = {
  name: "",
  shortCode: "",
  seasonal: false,
  sorbet: false,
};

export function FlavourEditor({ flavours, onChanged }: FlavourEditorProps) {
  const { profile } = useAuth();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveFlavour(form, editingId);
      setForm(emptyForm);
      setEditingId(undefined);
      setError(null);
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save flavour.");
    }
  }

  async function setActive(flavour: Flavour, active: boolean) {
    await setFlavourActive(flavour.id, active);
    await onChanged();
  }

  async function remove(flavour: Flavour) {
    await removeFlavour(flavour.id);
    await onChanged();
  }

  async function queueQueueBusterJob(flavour: Flavour, jobType: Extract<QueueBusterJobType, "audit_flavour" | "add_flavour" | "fix_flavour">) {
    if (!profile) return;

    try {
      setError(null);
      setQueueMessage(null);
      const requestPayload = {
        flavourId: flavour.id,
        flavourName: flavour.name.trim().toUpperCase(),
        shortCode: flavour.shortCode,
      };

      if (jobType === "audit_flavour") {
        await createQueueBusterJob({
          actorRole: profile.role,
          requestedBy: profile.id,
          jobType,
          requestPayload,
          instruction: `Audit QueueBuster flavour bundle for ${flavour.name}.`,
        });
        setQueueMessage(`Queued QueueBuster audit for ${flavour.name}.`);
        return;
      }

      const auditJob = await createQueueBusterJob({
        actorRole: profile.role,
        requestedBy: profile.id,
        jobType: "audit_flavour",
        requestPayload,
        instruction: `Audit before ${jobType === "add_flavour" ? "adding" : "fixing"} ${flavour.name}.`,
      });
      await createQueueBusterJob({
        actorRole: profile.role,
        requestedBy: profile.id,
        jobType,
        auditJobId: auditJob.id,
        requestPayload,
        instruction: `${jobType === "add_flavour" ? "Add" : "Fix"} ${flavour.name} after audit succeeds and Admin confirms.`,
      });
      setQueueMessage(
        `Queued QueueBuster audit and ${jobType === "add_flavour" ? "add" : "fix"} request for ${flavour.name}.`,
      );
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : "Unable to queue QueueBuster job.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Flavours</div>
      <form className="staff-form" aria-label="Flavour form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label className="field">
          <span>Short code</span>
          <input
            value={form.shortCode}
            onChange={(event) => setForm({ ...form, shortCode: event.target.value.toUpperCase() })}
            maxLength={6}
            required
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.seasonal}
            onChange={(event) => setForm({ ...form, seasonal: event.target.checked })}
          />
          <span>Seasonal</span>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.sorbet}
            onChange={(event) => setForm({ ...form, sorbet: event.target.checked })}
          />
          <span>Sorbet</span>
        </label>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {queueMessage ? <div className="alert alert-success">{queueMessage}</div> : null}
        <button className="primary-button" type="submit">
          {editingId ? "Save flavour" : "Add flavour"}
        </button>
      </form>

      <div className="list-stack catalog-list">
        {flavours.map((flavour) => (
          <article className="list-row catalog-row" key={flavour.id}>
            <div>
              <strong>{flavour.name}</strong>
              <span>{flavour.shortCode} {flavour.active ? "" : "Inactive"}</span>
            </div>
            <div className="row-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingId(flavour.id);
                  setForm({
                    name: flavour.name,
                    shortCode: flavour.shortCode,
                    seasonal: flavour.seasonal,
                    sorbet: flavour.sorbet,
                  });
                }}
              >
                Edit
              </button>
              <button className="secondary-button" type="button" onClick={() => setActive(flavour, !flavour.active)}>
                {flavour.active ? "Deactivate" : "Reactivate"}
              </button>
              <button
                aria-label={`Audit ${flavour.name} in QueueBuster`}
                className="secondary-button"
                type="button"
                onClick={() => void queueQueueBusterJob(flavour, "audit_flavour")}
              >
                QB audit
              </button>
              <button
                aria-label={`Add ${flavour.name} to QueueBuster`}
                className="secondary-button"
                type="button"
                onClick={() => void queueQueueBusterJob(flavour, "add_flavour")}
              >
                QB add
              </button>
              <button
                aria-label={`Fix ${flavour.name} in QueueBuster`}
                className="secondary-button"
                type="button"
                onClick={() => void queueQueueBusterJob(flavour, "fix_flavour")}
              >
                QB fix
              </button>
              <button className="danger-button" type="button" onClick={() => remove(flavour)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
