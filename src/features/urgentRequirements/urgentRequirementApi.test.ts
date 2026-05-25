import { beforeEach, describe, expect, it } from "vitest";
import { getDemoStaffByRole, resetDemoStaffData } from "../admin/staff/staffApi";
import {
  createUrgentRequirement,
  listUrgentRequirementEvents,
  listVisibleUrgentRequirements,
  resetDemoUrgentRequirementData,
  updateUrgentRequirementStatus,
} from "./urgentRequirementApi";

describe("urgent requirements", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoUrgentRequirementData();
  });

  it("lets stores raise urgent needs visible to lab and Rajpur", async () => {
    const created = await createUrgentRequirement({
      sourceLocationId: "malsi",
      requirementType: "gelato",
      relatedFlavourId: "flavour-pistachio",
      relatedCatalogItemId: null,
      quantity: 2,
      unit: "kg",
      priority: "urgent",
      message: "Need pistachio backup",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(created.status).toBe("submitted");
    expect(await listVisibleUrgentRequirements("lab_staff", "lab")).toHaveLength(1);
    expect(await listVisibleUrgentRequirements("store_staff", "rajpur")).toHaveLength(1);
    expect(await listVisibleUrgentRequirements("store_staff", "mussoorie")).toHaveLength(0);
    expect(await listVisibleUrgentRequirements("store_staff", "malsi")).toHaveLength(1);
  });

  it("blocks stores from creating urgent needs for another store", async () => {
    await expect(
      createUrgentRequirement({
        sourceLocationId: "rajpur",
        requirementType: "other",
        relatedFlavourId: null,
        relatedCatalogItemId: null,
        quantity: null,
        unit: null,
        priority: "urgent",
        message: "Need help",
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
      }),
    ).rejects.toThrow("Store users can only create urgent requirements for their active store.");
  });

  it("lets managers update urgent requirement status and hides fulfilled items", async () => {
    const manager = getDemoStaffByRole("lab_manager");
    const created = await createUrgentRequirement({
      sourceLocationId: "malsi",
      requirementType: "other",
      relatedFlavourId: null,
      relatedCatalogItemId: null,
      quantity: null,
      unit: null,
      priority: "urgent",
      message: "Need freezer check",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await updateUrgentRequirementStatus({
      requirementId: created.id,
      status: "fulfilled",
      actorId: manager.id,
      actorRole: manager.role,
    });

    expect(await listVisibleUrgentRequirements("lab_staff", "lab")).toHaveLength(0);
    expect(await listUrgentRequirementEvents(created.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "created", status: "submitted" }),
        expect.objectContaining({ eventType: "status_changed", status: "fulfilled" }),
      ]),
    );
  });
});
