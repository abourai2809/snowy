import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import {
  acceptIncomingDispatch,
  checkoutDisplayPan,
  listBackupPans,
  listDisplayPans,
  listIncomingDispatches,
  movePanToDisplay,
  listPanEvents,
  resetDemoStoreData,
} from "./storeApi";

describe("store display movement", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("requires weight for a partial pan and moves valid backup pans to display", async () => {
    const panUuid = await seedAcceptedStorePan();

    await expect(
      movePanToDisplay({
        panUuid,
        storeLocationId: "malsi",
        fillState: "partial",
        weightKg: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
      }),
    ).rejects.toThrow("Partial pans require a weight.");

    await movePanToDisplay({
      panUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.25,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    const display = await listDisplayPans("malsi");
    expect(display).toHaveLength(1);
    expect(display[0].currentWeightKg).toBe(1.25);
    expect(display[0].panRole).toBe("display");
  });

  it("flags gram-style weights before moving a pan to display", async () => {
    const panUuid = await seedAcceptedStorePan();

    await expect(
      movePanToDisplay({
        panUuid,
        storeLocationId: "malsi",
        fillState: "partial",
        weightKg: 6000,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
      }),
    ).rejects.toThrow("Partial pan weight looks too high. Enter kilograms, not grams. Use 6 instead of 6000.");
  });

  it("requires checkout before replacing the active display pan for a flavour", async () => {
    const [currentPanUuid, replacementPanUuid] = await seedAcceptedStorePans(2);

    await movePanToDisplay({
      panUuid: currentPanUuid,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await expect(
      movePanToDisplay({
        panUuid: replacementPanUuid,
        storeLocationId: "malsi",
        fillState: "full",
        weightKg: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
      }),
    ).rejects.toThrow("Check out the current display pan for this flavour before moving another pan to display.");

    await checkoutDisplayPan({
      panUuid: currentPanUuid,
      storeLocationId: "malsi",
      weightKg: 1.4,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });
    await movePanToDisplay({
      panUuid: replacementPanUuid,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    const [display, backup, events] = await Promise.all([
      listDisplayPans("malsi"),
      listBackupPans("malsi"),
      listPanEvents("malsi"),
    ]);
    expect(display).toEqual([expect.objectContaining({ id: replacementPanUuid })]);
    expect(backup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: currentPanUuid,
          currentWeightKg: 1.4,
          panRole: "backup",
          status: "returned",
        }),
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          panUuid: currentPanUuid,
          eventType: "display_pan_checked_out_to_deep",
          weightKg: 1.4,
        }),
      ]),
    );
  });
});

async function seedAcceptedStorePan() {
  return (await seedAcceptedStorePans(1))[0];
}

async function seedAcceptedStorePans(count: number) {
  const flavours = await listFlavours(true);
  const flavour = flavours.find((item) => item.shortCode === "PIS");
  expect(flavour).toBeDefined();

  const production = await createProduction({
    flavour: flavour!,
    productionDate: "2026-05-23",
    panCount: count,
    fullWeightKg: 3.5,
    notes: null,
    producedBy: "staff-lab",
  });
  await createDispatch({
    panUuids: production.pans.map((pan) => pan.id),
    toLocationId: "malsi",
    dispatchedBy: "staff-lab",
    notes: null,
  });
  const incoming = await listIncomingDispatches("malsi");
  await acceptIncomingDispatch({
    dispatchId: incoming[0].id,
    locationId: "malsi",
    notes: null,
    actorId: "staff-store",
    actorRole: "store_staff",
    actorLocationId: "malsi",
  });
  return production.pans.map((pan) => pan.id);
}
