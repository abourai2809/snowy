import type { Flavour } from "../../domain/flavours";
import type { Pan } from "../../domain/pans";

interface PanListProps {
  pans: Pan[];
  flavours: Flavour[];
}

export function PanList({ pans, flavours }: PanListProps) {
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));

  return (
    <section className="card">
      <div className="card-title">Lab inventory</div>
      {pans.length === 0 ? <p className="muted-copy">No lab inventory recorded yet.</p> : null}
      <div className="list-stack" aria-label="Lab inventory list">
        {pans.map((pan) => (
          <article className="list-row" key={pan.id}>
            <div>
              <strong>{pan.panId}</strong>
              <span>{flavourById.get(pan.flavourId)?.name ?? "Unknown flavour"}</span>
            </div>
            <span className="badge">{pan.status.replace("_", " ")}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
