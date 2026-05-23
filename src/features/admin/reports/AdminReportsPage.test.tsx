import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../../app/App";
import { getDemoStaffByRole, resetDemoStaffData } from "../staff/staffApi";
import { checkIn, resetDemoAttendanceData } from "../../attendance/attendanceApi";
import { resetDemoCatalogData } from "../../catalog/catalogApi";
import { resetDemoInventoryData } from "../../inventory/inventoryApi";
import { resetDemoLabData } from "../../lab/labApi";
import { resetDemoStoreData } from "../../store/storeApi";
import { renderApp, screen, userEvent } from "../../../test/render";

describe("AdminReportsPage", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
    resetDemoCatalogData();
    resetDemoInventoryData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("shows the attendance roster in Admin store oversight", async () => {
    const user = userEvent.setup();
    const storeStaff = getDemoStaffByRole("store_staff");
    await checkIn(storeStaff, new Date());

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Stores" }));

    expect(await screen.findByText("Today roster")).toBeInTheDocument();
    expect(screen.getByText(storeStaff.name)).toBeInTheDocument();
  });
});
