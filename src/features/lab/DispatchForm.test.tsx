import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoCatalogData, listFlavours } from "../catalog/catalogApi";
import { resetDemoLabData, createDispatch, createProduction, listLabPans } from "./labApi";

describe("DispatchForm/lab dispatch flow", () => {
  beforeEach(() => {
    resetDemoLabData();
    resetDemoCatalogData();
  });

  it("moves dispatched pans to in transit and blocks dispatching the same pan again", async () => {
    const flavours = await listFlavours(true);
    const flavour = flavours.find((item) => item.shortCode === "PSP");
    expect(flavour).toBeDefined();

    const production = await createProduction({
      flavour: flavour!,
      productionDate: "2026-05-23",
      panCount: 1,
      fullWeightKg: 3.5,
      notes: null,
      producedBy: "staff-lab",
    });

    await createDispatch({
      panUuids: [production.pans[0].id],
      toLocationId: "rajpur",
      dispatchedBy: "staff-lab",
      notes: null,
    });

    const pans = await listLabPans();
    expect(pans[0].status).toBe("in_transit");
    expect(pans[0].currentLocationId).toBe("rajpur");

    await expect(createDispatch({
      panUuids: [production.pans[0].id],
      toLocationId: "malsi",
      dispatchedBy: "staff-lab",
      notes: null,
    })).rejects.toThrow("Only available lab pans can be dispatched.");
  });
});
