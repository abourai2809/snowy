import { beforeEach, describe, expect, it } from "vitest";
import { getDemoStaffByRole, resetDemoStaffData } from "../admin/staff/staffApi";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { renderApp, screen, userEvent } from "../../test/render";
import { UrgentRequirementForm } from "./UrgentRequirementForm";
import { UrgentRequirementsPanel } from "./UrgentRequirementsPanel";
import { resetDemoUrgentRequirementData } from "./urgentRequirementApi";

describe("urgent requirement UI", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoUrgentRequirementData();
  });

  it("lets store staff submit an urgent requirement and shows it to lab", async () => {
    const user = userEvent.setup();
    const storeStaff = getDemoStaffByRole("store_staff");
    const labStaff = getDemoStaffByRole("lab_staff");
    const flavours = await listFlavours(true);

    const { unmount } = renderApp(
      <UrgentRequirementForm
        locationId="malsi"
        flavours={flavours}
        onCreated={() => undefined}
        actorId={storeStaff.id}
        actorRole={storeStaff.role}
        actorLocationId="malsi"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Flavour"), flavours.find((item) => item.shortCode === "PIS")!.id);
    await user.type(screen.getByLabelText("Qty"), "2");
    await user.clear(screen.getByLabelText("Details"));
    await user.type(screen.getByLabelText("Details"), "Need pistachio urgently");
    await user.click(screen.getByRole("button", { name: "Send urgent requirement" }));
    expect(await screen.findByText("Urgent requirement sent.")).toBeInTheDocument();
    unmount();

    renderApp(<UrgentRequirementsPanel profile={labStaff} locationId="lab" />);

    expect(await screen.findByText("Need pistachio urgently")).toBeInTheDocument();
    expect(screen.getByText("PISTACHTO")).toBeInTheDocument();
  });
});
