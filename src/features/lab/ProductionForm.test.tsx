import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { resetDemoCatalogData } from "../catalog/catalogApi";
import { renderApp, screen, userEvent, within } from "../../test/render";
import { listLabPans, resetDemoLabData } from "./labApi";

describe("ProductionForm", () => {
  beforeEach(() => {
    resetDemoLabData();
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("shows generated pan IDs for labelling after production is saved", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="lab_staff" />);
    await user.click(screen.getByRole("button", { name: "Lab" }));

    const flavourSelect = await screen.findByLabelText("Production flavour");
    const flavourOption = within(flavourSelect).getByRole("option", { name: "PISTACHTO" }) as HTMLOptionElement;
    await user.selectOptions(flavourSelect, flavourOption.value);
    await user.clear(screen.getByLabelText("Production date"));
    await user.type(screen.getByLabelText("Production date"), "2026-05-23");
    await user.clear(screen.getByLabelText("Pan count"));
    await user.type(screen.getByLabelText("Pan count"), "3");
    await user.clear(screen.getByLabelText("Pan 1 weight kg"));
    await user.type(screen.getByLabelText("Pan 1 weight kg"), "3.4");
    await user.clear(screen.getByLabelText("Pan 2 weight kg"));
    await user.type(screen.getByLabelText("Pan 2 weight kg"), "3.6");
    await user.clear(screen.getByLabelText("Pan 3 weight kg"));
    await user.type(screen.getByLabelText("Pan 3 weight kg"), "3.2");
    await user.click(screen.getByRole("button", { name: "Save production" }));

    const labelIds = await screen.findByLabelText("Pan IDs to label");
    expect(within(labelIds).getByText("PIS-20260523-01")).toBeInTheDocument();
    expect(within(labelIds).getByText("PIS-20260523-02")).toBeInTheDocument();
    expect(within(labelIds).getByText("PIS-20260523-03")).toBeInTheDocument();

    const panList = await screen.findByLabelText("Lab inventory list");
    expect(within(panList).getByText("PIS-20260523-01")).toBeInTheDocument();
    expect(within(panList).getByText("PIS-20260523-02")).toBeInTheDocument();
    expect(within(panList).getByText("PIS-20260523-03")).toBeInTheDocument();

    const pans = await listLabPans();
    expect(pans.map((pan) => [pan.panId, pan.fullWeightKg])).toEqual(expect.arrayContaining([
      ["PIS-20260523-01", 3.4],
      ["PIS-20260523-02", 3.6],
      ["PIS-20260523-03", 3.2],
    ]));
  });

  it("flags gram-style full pan weights", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="lab_staff" />);
    await user.click(screen.getByRole("button", { name: "Lab" }));

    await screen.findByLabelText("Production flavour");
    await user.clear(screen.getByLabelText("Pan 1 weight kg"));
    await user.type(screen.getByLabelText("Pan 1 weight kg"), "6000");
    await user.click(screen.getByRole("button", { name: "Save production" }));

    expect(
      await screen.findByText("Pan 1 weight looks too high. Enter kilograms, not grams. Use 6 instead of 6000."),
    ).toBeInTheDocument();
  });
});
