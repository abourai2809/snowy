import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, listLabDispatches, resetDemoLabData } from "../lab/labApi";
import {
  acceptIncomingDispatch,
  listBackupPans,
  listIncomingDispatches,
  listRejectedDispatches,
  receiveIncomingDispatchPans,
  rejectIncomingDispatch,
  resetDemoStoreData,
  overturnRejectedDispatch,
} from "./storeApi";
import { IncomingDispatches } from "./IncomingDispatches";
import { renderApp, screen, userEvent, within } from "../../test/render";

describe("store incoming dispatches", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("accepts a dispatched pan into store backup inventory", async () => {
    await seedIncomingDispatch();

    const incoming = await listIncomingDispatches("malsi");
    expect(incoming).toHaveLength(1);
    expect(incoming[0].pans[0].panId).toBe("PIS-20260523-01");

    await acceptIncomingDispatch({
      dispatchId: incoming[0].id,
      locationId: "malsi",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listIncomingDispatches("malsi")).toHaveLength(0);
    const backup = await listBackupPans("malsi");
    expect(backup).toHaveLength(1);
    expect(backup[0].panRole).toBe("backup");
    expect(backup[0].status).toBe("received");
  });

  it("lets the store overturn a rejected dispatch and accept it into backup inventory", async () => {
    await seedIncomingDispatch();

    const incoming = await listIncomingDispatches("malsi");
    await rejectIncomingDispatch({
      dispatchId: incoming[0].id,
      locationId: "malsi",
      notes: "Rejected by mistake.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listIncomingDispatches("malsi")).toHaveLength(0);
    const rejected = await listRejectedDispatches("malsi");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].pans[0].panId).toBe("PIS-20260523-01");

    await overturnRejectedDispatch({
      dispatchId: rejected[0].id,
      locationId: "malsi",
      notes: "Accepted after correction.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listRejectedDispatches("malsi")).toHaveLength(0);
    const backup = await listBackupPans("malsi");
    expect(backup).toEqual([expect.objectContaining({ panId: "PIS-20260523-01", status: "received" })]);
  });

  it("receives individual pans without rejecting the whole dispatch when one pan is missing", async () => {
    const { pans, dispatchId } = await seedIncomingDispatch(2);

    await receiveIncomingDispatchPans({
      dispatchId,
      locationId: "malsi",
      decisions: [
        { panUuid: pans[0].id, status: "accepted" },
        { panUuid: pans[1].id, status: "missing" },
      ],
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listIncomingDispatches("malsi")).toHaveLength(0);
    expect((await listLabDispatches()).find((dispatch) => dispatch.id === dispatchId)?.status).toBe("partially_accepted");
    expect(await listBackupPans("malsi")).toEqual([
      expect.objectContaining({ id: pans[0].id, panId: "PIS-20260523-01", status: "received" }),
    ]);

    const rejected = await listRejectedDispatches("malsi");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].panReceiptStatusByPanId[pans[1].id]).toBe("missing");

    await receiveIncomingDispatchPans({
      dispatchId,
      locationId: "malsi",
      decisions: [{ panUuid: pans[1].id, status: "accepted" }],
      notes: "Missing pan found.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listRejectedDispatches("malsi")).toHaveLength(0);
    expect((await listLabDispatches()).find((dispatch) => dispatch.id === dispatchId)?.status).toBe("accepted");
    expect(await listBackupPans("malsi")).toHaveLength(2);
  });

  it("groups incoming pan IDs by flavour for store staff", async () => {
    const flavours = await listFlavours(true);
    const pistachio = flavours.find((item) => item.shortCode === "PIS");
    const belgianChocolate = flavours.find((item) => item.shortCode === "BEL");
    expect(pistachio).toBeDefined();
    expect(belgianChocolate).toBeDefined();
    const pistachioProduction = await createProduction({
      flavour: pistachio!,
      productionDate: "2026-05-23",
      panCount: 2,
      fullWeightKg: 3.5,
      notes: null,
      producedBy: "staff-lab",
    });
    const belgianProduction = await createProduction({
      flavour: belgianChocolate!,
      productionDate: "2026-05-23",
      panCount: 1,
      fullWeightKg: 3.5,
      notes: null,
      producedBy: "staff-lab",
    });
    await createDispatch({
      panUuids: [...pistachioProduction.pans, ...belgianProduction.pans].map((pan) => pan.id),
      toLocationId: "malsi",
      dispatchedBy: "staff-lab",
      notes: null,
    });
    const incoming = await listIncomingDispatches("malsi");

    renderApp(
      <IncomingDispatches
        locationId="malsi"
        dispatches={incoming}
        rejectedDispatches={[]}
        flavours={flavours}
        onChanged={() => undefined}
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    const pistachioGroup = screen.getByText("PISTACHTO").closest(".incoming-flavour-group");
    const chocolateGroup = screen.getByText("BELGIAN CHOCOLATE").closest(".incoming-flavour-group");
    expect(pistachioGroup).not.toBeNull();
    expect(chocolateGroup).not.toBeNull();
    expect(within(pistachioGroup as HTMLElement).getByText("PIS-20260523-01")).toBeInTheDocument();
    expect(within(pistachioGroup as HTMLElement).getByText("PIS-20260523-02")).toBeInTheDocument();
    expect(within(chocolateGroup as HTMLElement).getByText("BEL-20260523-01")).toBeInTheDocument();
    expect(within(pistachioGroup as HTMLElement).getAllByRole("button", { name: "Accept" })).toHaveLength(2);
    expect(within(pistachioGroup as HTMLElement).getAllByRole("button", { name: "Missing" })).toHaveLength(2);
    expect(within(pistachioGroup as HTMLElement).getAllByRole("button", { name: "Reject" })).toHaveLength(2);
  });

  it("lets store staff mark only one visible incoming pan as missing", async () => {
    const user = userEvent.setup();
    await seedIncomingDispatch(2);
    const flavours = await listFlavours(true);
    const incoming = await listIncomingDispatches("malsi");
    let changed = 0;

    renderApp(
      <IncomingDispatches
        locationId="malsi"
        dispatches={incoming}
        rejectedDispatches={[]}
        flavours={flavours}
        onChanged={() => {
          changed += 1;
        }}
        actorId="staff-store"
        actorRole="store_staff"
        actorLocationId="malsi"
      />,
    );

    const secondPanRow = screen.getByText("PIS-20260523-02").closest(".incoming-pan-row");
    expect(secondPanRow).not.toBeNull();
    await user.click(within(secondPanRow as HTMLElement).getByRole("button", { name: "Missing" }));

    expect(await screen.findByText("PIS-20260523-02 marked missing.")).toBeInTheDocument();
    expect(changed).toBe(1);
    const rejected = await listRejectedDispatches("malsi");
    expect(rejected[0].panReceiptStatusByPanId[rejected[0].pans[1].id]).toBe("missing");
  });
});

async function seedIncomingDispatch(panCount = 1) {
  const flavours = await listFlavours(true);
  const flavour = flavours.find((item) => item.shortCode === "PIS");
  expect(flavour).toBeDefined();

  const production = await createProduction({
    flavour: flavour!,
    productionDate: "2026-05-23",
    panCount,
    fullWeightKg: 3.5,
    notes: null,
    producedBy: "staff-lab",
  });
  const dispatch = await createDispatch({
    panUuids: production.pans.map((pan) => pan.id),
    toLocationId: "malsi",
    dispatchedBy: "staff-lab",
    notes: null,
  });
  return { pans: production.pans, dispatchId: dispatch.id };
}
