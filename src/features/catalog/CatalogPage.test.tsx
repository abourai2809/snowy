import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { renderApp, screen, userEvent, waitFor, within } from "../../test/render";
import { resetDemoCatalogData } from "./catalogApi";

describe("CatalogPage", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("adds an Admin-created flavour and shows it in the Lab production selector", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Catalog" }));

    const form = await screen.findByRole("form", { name: "Flavour form" });
    await user.type(within(form).getByLabelText("Name"), "Blueberry Basil");
    await user.type(within(form).getByLabelText("Short code"), "BBB");
    await user.click(within(form).getByRole("button", { name: "Add flavour" }));

    expect(await screen.findByText("Blueberry Basil")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lab" }));
    expect(await screen.findByText("Blueberry Basil")).toBeInTheDocument();
  });

  it("adds a store supply and shows it in the Store supply checklist", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Catalog" }));
    await user.click(await screen.findByRole("button", { name: "Items" }));

    const form = await screen.findByRole("form", { name: "Catalog item form" });
    await user.type(within(form).getByLabelText("Item key"), "store-compostable-spoons");
    await user.type(within(form).getByLabelText("Name"), "Compostable Spoons");
    await user.selectOptions(within(form).getByLabelText("Category"), "cat-store-supplies");
    await user.selectOptions(within(form).getByLabelText("Kind"), "supply");
    await user.selectOptions(within(form).getByLabelText("Scope"), "store");
    await user.clear(within(form).getByLabelText("Unit"));
    await user.type(within(form).getByLabelText("Unit"), "pcs");
    await user.click(within(form).getByRole("button", { name: "Add item" }));

    expect(await screen.findByText("Compostable Spoons")).toBeInTheDocument();
    unmount();

    renderApp(<App initialRole="store_staff" />);
    await user.click(screen.getByRole("button", { name: "Store" }));

    expect(await screen.findByText("Compostable Spoons")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Catalog" })).not.toBeInTheDocument();
  });

  it("hides deactivated catalog items from new Store forms", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Catalog" }));
    await user.click(await screen.findByRole("button", { name: "Items" }));

    const napkinsText = await screen.findByText("Napkins");
    const row = napkinsText.closest("article");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(within(row as HTMLElement).getByRole("button", { name: "Reactivate" })).toBeInTheDocument());
    unmount();

    renderApp(<App initialRole="store_staff" />);
    await user.click(screen.getByRole("button", { name: "Store" }));

    await waitFor(() => expect(screen.queryByText("Napkins")).not.toBeInTheDocument());
  });
});
