import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, screen, userEvent } from "../../test/render";
import { App } from "../App";
import { MobileShell, type ShellUser } from "./MobileShell";
import { resetDemoStaffData } from "../../features/admin/staff/staffApi";
import { resetDemoAttendanceData } from "../../features/attendance/attendanceApi";
import { isSupabaseConfigured } from "../../lib/supabase";

const adminUser: ShellUser = {
  name: "Admin",
  role: "admin",
  locationLabel: "All locations",
};

describe("MobileShell", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("renders the mobile header and role navigation", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });

    renderApp(
      <MobileShell user={adminUser} activeRoute="dashboard" onNavigate={vi.fn()}>
        <div>Shell body</div>
      </MobileShell>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Snowy Owl Gelato Co");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Catalog" })).toBeInTheDocument();
  });

  it("navigates with icon buttons", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    renderApp(
      <MobileShell user={adminUser} activeRoute="dashboard" onNavigate={onNavigate}>
        <div>Shell body</div>
      </MobileShell>,
    );

    await user.click(screen.getByRole("button", { name: "Lab" }));

    expect(onNavigate).toHaveBeenCalledWith("lab");
  });

  it("navigates from dashboard cards", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="admin" />);

    await user.click(screen.getByRole("button", { name: "Catalog setup" }));

    expect(screen.getByRole("heading", { name: "Catalog" })).toBeInTheDocument();
  });

  it("hides Admin-only routes for store staff", () => {
    renderApp(<App initialRole="store_staff" />);

    expect(screen.getByRole("button", { name: "Store" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Incoming pans" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Catalog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Staff" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role")).not.toBeInTheDocument();
  });

  it("uses the persona entry screen instead of exposing role switching inside staff views", async () => {
    const user = userEvent.setup();

    renderApp(<App />);

    expect(screen.getByRole("heading", { name: "Snowy Owl" })).toBeInTheDocument();
    if (isSupabaseConfigured) {
      expect(screen.queryByRole("button", { name: "Store Staff Malsi" })).not.toBeInTheDocument();
      return;
    }

    await user.click(screen.getByRole("button", { name: "Store Staff Malsi" }));

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Catalog" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role")).not.toBeInTheDocument();
  });
});
