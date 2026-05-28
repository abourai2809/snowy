import { useState, type ReactNode } from "react";
import type { LocationOption } from "../../domain/roles";
import { validateLocationForStore, type LocationValidationResult } from "./locationValidation";

interface LocationValidationGateProps {
  id?: string;
  location: LocationOption;
  workflowName: string;
  children: ReactNode;
}

export function LocationValidationGate({ children, id, location, workflowName }: LocationValidationGateProps) {
  const [inputsOpen, setInputsOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<LocationValidationResult | null>(null);

  async function confirm() {
    setValidating(true);
    const validation = await validateLocationForStore(location);
    setResult(validation);
    setInputsOpen(validation.status === "verified");
    setValidating(false);
  }

  if (!inputsOpen) {
    return (
      <section className="card" id={id}>
        <div className="card-title">Confirm store</div>
        {result ? (
          <div className={result.status === "verified" ? "alert alert-success" : "alert alert-danger"}>
            {result.message}
          </div>
        ) : (
          <p className="muted-copy">
            This {workflowName} is for <strong>{location.name}</strong>.
          </p>
        )}
        {result && result.status !== "verified" ? (
          <button className="primary-button" type="button" onClick={() => setInputsOpen(true)}>
            Continue to {workflowName}
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={() => void confirm()} disabled={validating}>
            {validating ? "Checking location..." : `Confirm ${location.name}`}
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      {result ? (
        <div className={result.status === "verified" ? "alert alert-success" : "alert alert-danger"}>
          {result.message}
        </div>
      ) : null}
      {children}
    </>
  );
}
