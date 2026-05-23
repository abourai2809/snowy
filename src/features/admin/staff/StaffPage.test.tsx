import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../../app/App";
import { resetDemoAttendanceData } from "../../attendance/attendanceApi";
import { renderApp, screen, userEvent, waitFor, within } from "../../../test/render";
import { resetDemoStaffData } from "./staffApi";

describe("StaffPage", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("lets Admin add staff and update holiday settings", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Staff" }));

    const form = await screen.findByRole("form", { name: "Add staff form" });
    await user.type(within(form).getByLabelText("Name"), "New Counter Staff");
    await user.type(within(form).getByLabelText("Phone"), "9000001111");
    await user.selectOptions(within(form).getByLabelText("Role"), "store_staff");
    await user.selectOptions(within(form).getByLabelText("Location"), "rajpur");
    await user.clear(within(form).getByLabelText("Allowed holidays"));
    await user.type(within(form).getByLabelText("Allowed holidays"), "2");
    await user.clear(within(form).getByLabelText("Bonus days"));
    await user.type(within(form).getByLabelText("Bonus days"), "1");
    await user.click(within(form).getByRole("button", { name: "Add staff" }));

    const newStaffRow = await screen.findByText("New Counter Staff");
    expect(newStaffRow).toBeInTheDocument();

    const row = newStaffRow.closest("article");
    expect(row).not.toBeNull();
    await user.clear(within(row as HTMLElement).getByLabelText("Bonus days"));
    await user.type(within(row as HTMLElement).getByLabelText("Bonus days"), "3");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Save holidays" }));

    await waitFor(() => expect(within(row as HTMLElement).getByLabelText("Bonus days")).toHaveValue(3));
  });

  it("does not expose Staff controls to Store Staff", () => {
    renderApp(<App initialRole="store_staff" />);

    expect(screen.queryByRole("button", { name: "Staff" })).not.toBeInTheDocument();
    expect(screen.queryByText("Staff roster")).not.toBeInTheDocument();
  });
});
