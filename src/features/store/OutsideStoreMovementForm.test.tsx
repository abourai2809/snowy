import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, listPansByIds, resetDemoLabData } from "../lab/labApi";
import {
  acceptIncomingDispatch,
  listBackupPans,
  listIncomingDispatches,
  listPanEvents,
  movePanOutsideStore,
  resetDemoStoreData,
} from "./storeApi";
import { OutsideStoreMovementForm } from "./OutsideStoreMovementForm";
import { renderApp, screen, userEvent, waitFor } from "../../test/render";

describe("outside store pan movement", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("moves a store backup pan out for event or B2B use", async () => {
    const panUuid = await seedAcceptedStorePan();

    await movePanOutsideStore({
      panUuid,
      storeLocationId: "malsi",
      destinationType: "event_b2b",
      eventName: "Wedding dessert counter",
      eventDate: "2026-07-05",
      notes: "B2B order",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await expect(listBackupPans("malsi")).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: panUuid })]),
    );
    await expect(listPansByIds([panUuid])).resolves.toEqual([
      expect.objectContaining({
        id: panUuid,
        currentLocationId: null,
        panRole: "event",
        status: "reserved",
      }),
    ]);
    await expect(listPanEvents("malsi")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          panUuid,
          eventType: "moved_outside_store",
          fromLocationId: "malsi",
          toLocationId: null,
          toRole: "event",
          metadata: expect.objectContaining({
            destinationType: "event_b2b",
            eventName: "Wedding dessert counter",
            eventDate: "2026-07-05",
            notes: "B2B order",
            sourceStoreLocationId: "malsi",
          }),
        }),
      ]),
    );
  });

  it("lets store staff move a selected pan outside store from the form", async () => {
    const user = userEvent.setup();
    const panUuid = await seedAcceptedStorePan();
    const [flavours, backupPans] = await Promise.all([listFlavours(true), listBackupPans("malsi")]);
    const pistachio = flavours.find((flavour) => flavour.shortCode === "PIS");
    expect(pistachio).toBeDefined();

    renderApp(
      <OutsideStoreMovementForm
        locationId="malsi"
        backupPans={backupPans}
        flavours={flavours}
        onChanged={() => undefined}
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Flavour"), pistachio!.id);
    expect(screen.getByLabelText("Pan ID")).toHaveValue(panUuid);
    await user.type(screen.getByLabelText("Event/B2B name"), "Corporate order");
    await user.type(screen.getByLabelText("Date"), "2026-07-06");
    await user.type(screen.getByLabelText("Notes"), "Owner approved");
    await user.click(screen.getByRole("button", { name: "Move pan out" }));

    await waitFor(() => expect(screen.getByText("Pan moved outside store.")).toBeInTheDocument());
    await expect(listBackupPans("malsi")).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: panUuid })]),
    );
  });
});

async function seedAcceptedStorePan() {
  const flavours = await listFlavours(true);
  const flavour = flavours.find((item) => item.shortCode === "PIS");
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
  return production.pans[0].id;
}
