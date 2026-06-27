import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData, updatePanState } from "../lab/labApi";
import { renderApp, screen, waitFor } from "../../test/render";
import { resetDemoDeepFreezerData, submitDeepFreezerCount } from "./deepFreezerApi";
import { EodGelatoCount } from "./EodGelatoCount";
import {
  acceptIncomingDispatch,
  listBackupPans,
  listIncomingDispatches,
  listDisplayPans,
  listEmptyPanCountsByStore,
  listPanEvents,
  movePanToDisplay,
  resetDemoStoreData,
  submitEodGelatoCount,
} from "./storeApi";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("store EOD gelato counts", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
    resetDemoDeepFreezerData();
  });

  it("records only display pan weights", async () => {
    const [displayPanUuid, backupPanUuid] = await seedStorePans(2);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await expect(
      submitEodGelatoCount({
        locationId: "malsi",
        businessDate: todayDate(),
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [
          { panUuid: displayPanUuid, weightKg: 1.1 },
          { panUuid: backupPanUuid, weightKg: 3.5 },
        ],
      }),
    ).rejects.toThrow("End-of-day gelato counts can only include display pans.");

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 1.1 }],
    });

    expect(count.status).toBe("submitted");
    expect(count.items).toHaveLength(1);
    expect(count.items[0].panId).toBe(displayPanUuid);
  });

  it("returns non-empty display pans to deep while keeping the display assignment", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 1.1 }],
    });

    const [displayPans, backupPans, events] = await Promise.all([
      listDisplayPans("malsi"),
      listBackupPans("malsi"),
      listPanEvents("malsi"),
    ]);

    expect(displayPans).toEqual([
      expect.objectContaining({
        id: displayPanUuid,
        currentWeightKg: 1.1,
        panRole: "display",
        status: "returned",
      }),
    ]);
    expect(backupPans).toEqual([
      expect.objectContaining({
        id: displayPanUuid,
        currentWeightKg: 1.1,
        panRole: "display",
        status: "returned",
      }),
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          panUuid: displayPanUuid,
          eventType: "display_pan_returned_to_deep",
          weightKg: 1.1,
        }),
      ]),
    );
  });

  it("closes zero-weight display pans and counts empty pans by store", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 0.5,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 0 }],
    });

    const [displayPans, backupPans, emptyCounts, events] = await Promise.all([
      listDisplayPans("malsi"),
      listBackupPans("malsi"),
      listEmptyPanCountsByStore("malsi"),
      listPanEvents("malsi"),
    ]);

    expect(displayPans).toHaveLength(0);
    expect(backupPans).toHaveLength(0);
    expect(emptyCounts).toEqual([{ locationId: "malsi", emptyPanCount: 1 }]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          panUuid: displayPanUuid,
          eventType: "display_pan_depleted",
          weightKg: 0,
        }),
      ]),
    );
  });

  it("infers the active display pan from a flavour-level EOD weight", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 1.15 }],
    });

    expect(count.items).toHaveLength(1);
    expect(count.items[0].panId).toBe(displayPanUuid);
    expect(count.items[0].flavourId).toBe(flavour!.id);
    expect(count.items[0].weightKg).toBe(1.15);

    const [displayPans, backupPans] = await Promise.all([listDisplayPans("malsi"), listBackupPans("malsi")]);
    expect(displayPans).toEqual([expect.objectContaining({ id: displayPanUuid, status: "returned", currentWeightKg: 1.15 })]);
    expect(backupPans).toEqual([expect.objectContaining({ id: displayPanUuid, status: "returned", currentWeightKg: 1.15 })]);
  });

  it("keeps unmatched flavour-level EOD rows for review when no active display pan exists", async () => {
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 1.15 }],
    });

    expect(count.items).toHaveLength(1);
    expect(count.items[0].panId).toBeNull();
    expect(count.items[0].flavourId).toBe(flavour!.id);
    expect(count.items[0].notes).toBe("review: no active display pan for this flavour");
  });

  it("flags over-capacity flavour-level EOD rows for review", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 4 }],
    });

    expect(count.items).toHaveLength(1);
    expect(count.items[0].panId).toBeNull();
    expect(count.items[0].notes).toBe("review: EOD display weight exceeds active display pan capacity");
  });

  it("allocates flavour-level EOD weight across multiple active display pans using FIFO review notes", async () => {
    const [olderPanUuid, newerPanUuid] = await seedStorePans(2);
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();
    await Promise.all([
      updatePanState(olderPanUuid, {
        panRole: "display",
        status: "display",
        currentWeightKg: 3.5,
      }),
      updatePanState(newerPanUuid, {
        panRole: "display",
        status: "display",
        currentWeightKg: 3.5,
      }),
    ]);

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 4 }],
    });

    expect(count.items).toEqual([
      expect.objectContaining({
        panId: olderPanUuid,
        weightKg: 0.5,
        notes: "review: multiple active display pans; FIFO allocation applied",
      }),
      expect.objectContaining({
        panId: newerPanUuid,
        weightKg: 3.5,
        notes: "review: multiple active display pans; FIFO allocation applied",
      }),
    ]);
  });

  it("flags gram-style EOD weights", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await expect(
      submitEodGelatoCount({
        locationId: "malsi",
        businessDate: todayDate(),
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [{ panUuid: displayPanUuid, weightKg: 6000 }],
      }),
    ).rejects.toThrow("EOD gelato weight looks too high. Enter kilograms, not grams. Use 6 instead of 6000.");
  });

  it("rejects pan-level EOD weights above the opening display weight", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await expect(
      submitEodGelatoCount({
        locationId: "malsi",
        businessDate: todayDate(),
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [{ panUuid: displayPanUuid, weightKg: 1.3 }],
      }),
    ).rejects.toThrow("EOD weight for PIS-20260523-01 cannot be higher than opening weight (1.2 kg).");
  });

  it("lets Store Manager correct same-day counts", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });
    await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 3.5 }],
    });

    const corrected = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: "Corrected closing weight",
      actorId: "staff-manager",
      actorRole: "store_manager",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 3.2 }],
    });

    expect(corrected.status).toBe("corrected");
    expect(corrected.correctedBy).toBe("staff-manager");
    expect(corrected.items).toHaveLength(1);
    expect(corrected.items[0].weightKg).toBe(3.2);
  });

  it("blocks store staff from correcting another store", async () => {
    await expect(
      submitEodGelatoCount({
        locationId: "rajpur",
        businessDate: todayDate(),
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [],
      }),
    ).rejects.toThrow("Store users can only work in their assigned store.");
  });

  it("prefills relevant EOD rows without an add-line dropdown", async () => {
    const flavours = await listFlavours(true);
    const flavour = flavours.find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();
    await submitDeepFreezerCount({
      locationId: "malsi",
      businessDate: "2020-01-01",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 2 }],
    });

    renderApp(
      <EodGelatoCount
        locationId="malsi"
        flavours={flavours}
        onChanged={() => undefined}
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    expect(await screen.findByText("No display pans found for today.")).toBeInTheDocument();
    expect(screen.queryByLabelText(`EOD weight ${flavour!.name}`)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add gelato line" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/EOD gelato item/)).not.toBeInTheDocument();
  });

  it("shows flavour first with display-pan count detail", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    const flavours = await listFlavours(true);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    renderApp(
      <EodGelatoCount
        locationId="malsi"
        flavours={flavours}
        onChanged={() => undefined}
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    await waitFor(() => expect(screen.getByText("PISTACHTO")).toBeInTheDocument());
    expect(screen.getByText("PIS-20260523-01")).toBeInTheDocument();
    expect(screen.getByText("Opening 3.5 kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit weight" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

async function seedStorePans(count: number) {
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
