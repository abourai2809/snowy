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
  swapPanToDisplay,
} from "./storeApi";
import { DisplayMovementForm } from "./DisplayMovementForm";
import { renderApp, screen, userEvent, waitFor, within } from "../../test/render";

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

  it("swaps the current display pan and selected deep freezer pan in one submission", async () => {
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

    await swapPanToDisplay({
      panUuid: replacementPanUuid,
      storeLocationId: "malsi",
      checkoutPanUuid: currentPanUuid,
      checkoutWeightKg: 1.1,
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
          currentWeightKg: 1.1,
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
          weightKg: 1.1,
        }),
        expect.objectContaining({
          panUuid: replacementPanUuid,
          eventType: "moved_to_display",
        }),
      ]),
    );
  });

  it("filters pan IDs by selected flavour and swaps from the form", async () => {
    const user = userEvent.setup();
    const [currentPanUuid, replacementPanUuid] = await seedAcceptedStorePans(2, "PIS");
    await seedAcceptedStorePans(1, "BEL");
    await movePanToDisplay({
      panUuid: currentPanUuid,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });
    const [flavours, backupPans, displayPans] = await Promise.all([
      listFlavours(true),
      listBackupPans("malsi"),
      listDisplayPans("malsi"),
    ]);
    const pistachio = flavours.find((flavour) => flavour.shortCode === "PIS");
    expect(pistachio).toBeDefined();

    renderApp(
      <DisplayMovementForm
        locationId="malsi"
        backupPans={backupPans}
        displayPans={displayPans}
        flavours={flavours}
        onChanged={() => undefined}
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Flavour"), pistachio!.id);
    const panSelect = screen.getByLabelText("Pan ID");
    expect(within(panSelect).getByRole("option", { name: /PIS-20260523-02/ })).toBeInTheDocument();
    expect(within(panSelect).queryByRole("option", { name: /BEL-20260523-01/ })).not.toBeInTheDocument();
    expect(screen.getByText("Current display pan")).toBeInTheDocument();
    expect(screen.getByText(/PIS-20260523-01/)).toBeInTheDocument();

    await user.selectOptions(panSelect, replacementPanUuid);
    await user.clear(screen.getByLabelText(/Checkout weight PIS-20260523-01/));
    await user.type(screen.getByLabelText(/Checkout weight PIS-20260523-01/), "1.2");
    await user.click(screen.getByRole("button", { name: "Swap pan" }));

    await waitFor(() => expect(screen.getByText("Display pan swapped.")).toBeInTheDocument());
    await expect(listDisplayPans("malsi")).resolves.toEqual([expect.objectContaining({ id: replacementPanUuid })]);
  });
});

async function seedAcceptedStorePan() {
  return (await seedAcceptedStorePans(1))[0];
}

async function seedAcceptedStorePans(count: number, shortCode = "PIS") {
  const flavours = await listFlavours(true);
  const flavour = flavours.find((item) => item.shortCode === shortCode);
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
