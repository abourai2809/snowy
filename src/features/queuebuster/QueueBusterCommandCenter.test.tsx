import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { resetDemoCatalogData } from "../catalog/catalogApi";
import { renderApp, screen, userEvent, within } from "../../test/render";
import { resetDemoQueueBusterData } from "./queueBusterJobsApi";

describe("QueueBusterCommandCenter", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoAttendanceData();
    resetDemoQueueBusterData();
  });

  it("lets Admin create a QueueBuster audit job from Catalog", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="admin" />);
    await openQueueBusterTab(user);

    const form = await screen.findByRole("form", { name: "QueueBuster job form" });
    await user.type(within(form).getByLabelText("Flavour name"), "Popcorn");
    await user.type(within(form).getByLabelText("Instruction"), "Check standard Snowy Owl bundle");
    await user.click(within(form).getByRole("button", { name: "Create QueueBuster job" }));

    expect(await screen.findByText("QueueBuster job queued.")).toBeInTheDocument();
    expect(await screen.findByText("POPCORN")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("keeps add flavour jobs paused until the linked audit succeeds", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="admin" />);
    await openQueueBusterTab(user);

    const form = await screen.findByRole("form", { name: "QueueBuster job form" });
    await user.type(within(form).getByLabelText("Flavour name"), "Lychee");
    await user.click(within(form).getByRole("button", { name: "Create QueueBuster job" }));
    expect(await screen.findByText("LYCHEE")).toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText("Action"), "add_flavour");
    await user.type(within(form).getByLabelText("Flavour name"), "Lychee");
    await user.selectOptions(within(form).getByLabelText("Audit job"), within(form).getByLabelText("Audit job").querySelector("option:nth-of-type(2)")?.getAttribute("value") ?? "");
    await user.click(within(form).getByRole("button", { name: "Create QueueBuster job" }));

    expect(await screen.findByText("QueueBuster job is waiting for audit completion and confirmation.")).toBeInTheDocument();
    expect(await screen.findByText("Needs confirmation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audit pending" })).toBeDisabled();
  });

  it("does not expose QueueBuster actions to store staff", async () => {
    renderApp(<App initialRole="store_staff" />);

    expect(screen.queryByRole("button", { name: "Catalog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "QueueBuster" })).not.toBeInTheDocument();
  });
});

async function openQueueBusterTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Catalog" }));
  await user.click(await screen.findByRole("button", { name: "QueueBuster" }));
}
