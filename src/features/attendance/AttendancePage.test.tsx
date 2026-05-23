import { beforeEach, describe, expect, it } from "vitest";
import { renderApp, screen, userEvent, waitFor } from "../../test/render";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "./attendanceApi";

describe("AttendancePage", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("lets staff check in and check out once per day", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="store_staff" />);
    await user.click(screen.getByRole("button", { name: "Attendance" }));

    expect(await screen.findByText("Not checked in")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText("Checked in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Check out" }));
    expect(await screen.findByText("Checked out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check out" })).toBeDisabled();
  });

  it("shows today's attendance roster to Admin", async () => {
    const staffUser = userEvent.setup();
    const { unmount } = renderApp(<App initialRole="store_staff" />);
    await staffUser.click(screen.getByRole("button", { name: "Attendance" }));
    await staffUser.click(await screen.findByRole("button", { name: "Check in" }));
    await waitFor(() => expect(screen.getByText("Checked in")).toBeInTheDocument());
    unmount();

    renderApp(<App initialRole="admin" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Attendance" }));

    expect(await screen.findByLabelText("Attendance roster")).toHaveTextContent("Sneha Joshi");
  });
});
