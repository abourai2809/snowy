import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import { acceptIncomingDispatch, checkoutDisplayPan, movePanToDisplay, resetDemoStoreData } from "./storeApi";
import { StorePanInventorySummary } from "./StorePanInventorySummary";
import { renderApp, screen, userEvent, within } from "../../test/render";

describe("StorePanInventorySummary", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("shows store and flavour pan counts with filters", async () => {
    const user = userEvent.setup();
    const flavours = await listFlavours(true);
    const pistachio = flavours.find((flavour) => flavour.shortCode === "PIS");
    expect(pistachio).toBeDefined();

    const production = await createProduction({
      flavour: pistachio!,
      productionDate: "2026-05-23",
      panWeightsKg: [3.5, 3.5],
      notes: null,
      producedBy: "staff-lab",
    });
    const dispatch = await createDispatch({
      panUuids: production.pans.map((pan) => pan.id),
      toLocationId: "malsi",
      dispatchedBy: "staff-lab",
      notes: null,
    });
    await acceptIncomingDispatch({
      dispatchId: dispatch.id,
      locationId: "malsi",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });
    await movePanToDisplay({
      panUuid: production.pans[0].id,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });
    await checkoutDisplayPan({
      panUuid: production.pans[0].id,
      storeLocationId: "malsi",
      weightKg: 1.1,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    renderApp(<StorePanInventorySummary />);

    await screen.findByRole("table", { name: "Store pan inventory" });
    await user.selectOptions(screen.getByLabelText("Inventory store"), "malsi");
    await user.selectOptions(screen.getByLabelText("Inventory flavour"), pistachio!.id);

    const table = screen.getByRole("table", { name: "Store pan inventory" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(2);
    const cells = within(rows[1]).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Malsi");
    expect(cells[1]).toHaveTextContent("PISTACHTO");
    expect(cells[2]).toHaveTextContent("1");
    expect(cells[3]).toHaveTextContent("1");

    await user.type(screen.getByLabelText("Backup pan threshold"), "0");
    expect(screen.getByText("No store pan inventory rows match these filters.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Backup pan threshold"));
    await user.type(screen.getByLabelText("Backup pan threshold"), "1");
    expect(within(screen.getByRole("table", { name: "Store pan inventory" })).getByText("low backup")).toBeInTheDocument();
  });
});
