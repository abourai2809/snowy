import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { resetDemoDeepFreezerData, submitDeepFreezerCount } from "./deepFreezerApi";
import { MorningInventoryVerification } from "./MorningInventoryVerification";
import { renderApp, screen, userEvent } from "../../test/render";

describe("MorningInventoryVerification", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoDeepFreezerData();
  });

  it("prefills expected freezer weights and records discrepancies", async () => {
    const user = userEvent.setup();
    const flavours = await listFlavours(true);
    const flavour = flavours.find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();

    await submitDeepFreezerCount({
      locationId: "malsi",
      businessDate: "2026-05-25",
      countType: "eod",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 2 }],
    });

    renderApp(
      <MorningInventoryVerification
        locationId="malsi"
        businessDate="2026-05-26"
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    const input = await screen.findByLabelText("Morning weight PISTACHTO");
    expect(input).toHaveValue(2);

    await user.clear(input);
    await user.type(input, "1.7");
    await user.click(screen.getByRole("button", { name: "Submit morning check" }));

    expect(await screen.findByText("Morning check submitted with 1 discrepancies.")).toBeInTheDocument();
    expect(screen.getByText(/Expected 2.00 kg \/ difference -0.30 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Ask a Store Manager to correct/)).toBeInTheDocument();
  });
});
