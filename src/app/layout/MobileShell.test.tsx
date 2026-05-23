import { describe, expect, it, vi } from "vitest";
import { renderApp, screen, userEvent } from "../../test/render";
import { App } from "../App";
import { MobileShell, type ShellUser } from "./MobileShell";

const adminUser: ShellUser = {
  name: "Admin",
  role: "admin",
  locationLabel: "All locations",
};

describe("MobileShell", () => {
  it("renders the mobile header and role navigation", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });

    renderApp(
      <MobileShell user={adminUser} activeRoute="dashboard" onNavigate={vi.fn()}>
        <div>Shell body</div>
      </MobileShell>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Snowy Owl");
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

  it("hides Admin-only routes for store staff", () => {
    renderApp(<App initialRole="store_staff" />);

    expect(screen.getByRole("button", { name: "Store" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Catalog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Staff" })).not.toBeInTheDocument();
  });

  it("returns to an allowed route when the role changes", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Catalog" }));
    expect(screen.getByRole("heading", { name: "Catalog" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Role"), "store_staff");

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Catalog" })).not.toBeInTheDocument();
  });
});
