import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { renderApp, screen, userEvent } from "../../test/render";

describe("LoginPage", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("lets a staff member submit a signup request", async () => {
    const user = userEvent.setup();

    renderApp(<App />);

    await user.click(await screen.findByRole("button", { name: "Request staff access" }));
    await user.type(screen.getByLabelText("Name"), "New Store Signup");
    await user.type(screen.getByLabelText("Mobile number"), "9000003333");
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.click(screen.getByRole("button", { name: "Submit signup" }));

    expect(await screen.findByText("Signup submitted. Ask Admin to approve before signing in.")).toBeInTheDocument();
  });
});
