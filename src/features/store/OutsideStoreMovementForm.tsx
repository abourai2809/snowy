import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";
import { movePanOutsideStore, type OutsideStoreDestinationType, type StoreActor } from "./storeApi";

interface OutsideStoreMovementFormProps extends StoreActor {
  locationId: string;
  backupPans: Pan[];
  flavours: Flavour[];
  onChanged: () => void;
}

export function OutsideStoreMovementForm({
  actorId,
  actorLocationId,
  actorRole,
  backupPans,
  flavours,
  locationId,
  onChanged,
}: OutsideStoreMovementFormProps) {
  const [flavourId, setFlavourId] = useState("");
  const [panUuid, setPanUuid] = useState("");
  const [destinationType, setDestinationType] = useState<OutsideStoreDestinationType>("event_b2b");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidatePans = useMemo(
    () => backupPans.filter((pan) => pan.flavourId === flavourId),
    [backupPans, flavourId],
  );
  const selectedPanUuid = panUuid || candidatePans[0]?.id || "";
  const canSubmit = Boolean(flavourId && selectedPanUuid && eventName.trim());

  useEffect(() => {
    setPanUuid("");
  }, [flavourId]);

  useEffect(() => {
    if (panUuid && !candidatePans.some((pan) => pan.id === panUuid)) {
      setPanUuid("");
    }
  }, [candidatePans, panUuid]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await movePanOutsideStore({
        panUuid: selectedPanUuid,
        storeLocationId: locationId,
        destinationType,
        eventName,
        eventDate: eventDate || null,
        notes: notes || null,
        actorId,
        actorRole,
        actorLocationId,
      });
      setMessage("Pan moved outside store.");
      setFlavourId("");
      setPanUuid("");
      setDestinationType("event_b2b");
      setEventName("");
      setEventDate("");
      setNotes("");
      onChanged();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to move pan outside store.");
    }
  }

  return (
    <section className="card">
      <div className="card-title">Move pan outside store</div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      <form aria-label="Outside store movement form" onSubmit={submit}>
        <label className="field">
          <span>Flavour</span>
          <select value={flavourId} onChange={(event) => setFlavourId(event.target.value)} required>
            <option value="">Select flavour</option>
            {flavours.map((flavour) => (
              <option value={flavour.id} key={flavour.id}>
                {flavour.name}
              </option>
            ))}
          </select>
        </label>

        {flavourId && candidatePans.length === 0 ? (
          <p className="muted-copy">No deep freezer pan IDs available for this flavour.</p>
        ) : null}

        {candidatePans.length > 0 ? (
          <label className="field">
            <span>Pan ID</span>
            <select value={selectedPanUuid} onChange={(event) => setPanUuid(event.target.value)} required>
              {candidatePans.map((pan) => (
                <option value={pan.id} key={pan.id}>
                  {pan.panId}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span>Destination</span>
          <select
            value={destinationType}
            onChange={(event) => setDestinationType(event.target.value as OutsideStoreDestinationType)}
            required
          >
            <option value="event_b2b">Event/B2B</option>
          </select>
        </label>

        <label className="field">
          <span>Event/B2B name</span>
          <input value={eventName} onChange={(event) => setEventName(event.target.value)} required />
        </label>

        <label className="field">
          <span>Date</span>
          <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
        </label>

        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        </label>

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Move pan out
        </button>
      </form>
    </section>
  );
}
