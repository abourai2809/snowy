import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { resetDemoCatalogData } from "../catalog/catalogApi";
import { renderApp, screen, userEvent, within } from "../../test/render";
import { resetDemoLabData } from "./labApi";

describe("ProductionForm", () => {
  beforeEach(() => {
    resetDemoLabData();
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("produces unique pan IDs from flavour code, date, and sequence", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="lab_staff" />);
    await user.click(screen.getByRole("button", { name: "Lab" }));

    const flavourSelect = await screen.findByLabelText("Production flavour");
    const flavourOption = screen.getByRole("option", { name: "PISTACHTO" }) as HTMLOptionElement;
    await user.selectOptions(flavourSelect, flavourOption.value);
    await user.clear(screen.getByLabelText("Production date"));
    await user.type(screen.getByLabelText("Production date"), "2026-05-23");
    await user.clear(screen.getByLabelText("Pan count"));
    await user.type(screen.getByLabelText("Pan count"), "3");
    await user.click(screen.getByRole("button", { name: "Save production" }));

    const panList = await screen.findByLabelText("Lab inventory list");
    expect(within(panList).getByText("PIS-20260523-01")).toBeInTheDocument();
    expect(within(panList).getByText("PIS-20260523-02")).toBeInTheDocument();
    expect(within(panList).getByText("PIS-20260523-03")).toBeInTheDocument();
  });

  it("flags gram-style full pan weights", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="lab_staff" />);
    await user.click(screen.getByRole("button", { name: "Lab" }));

    await screen.findByLabelText("Production flavour");
    await user.clear(screen.getByLabelText("Full pan weight kg"));
    await user.type(screen.getByLabelText("Full pan weight kg"), "6000");
    await user.click(screen.getByRole("button", { name: "Save production" }));

    expect(
      await screen.findByText("Full pan weight looks too high. Enter kilograms, not grams. Use 6 instead of 6000."),
    ).toBeInTheDocument();
  });
});
