import { describe, expect, it } from "vitest";
import { canAccessRoute, getCardTargetRoute, getDefaultRouteForRole, getRoutesForRole } from "./routes";

describe("role routes", () => {
  it("lets Admin reach operational and admin setup routes", () => {
    expect(getRoutesForRole("admin").map((route) => route.id)).toEqual([
      "dashboard",
      "attendance",
      "lab",
      "stores",
      "review",
      "catalog",
      "staff",
    ]);
  });

  it("keeps store staff on store-facing routes", () => {
    expect(getRoutesForRole("store_staff").map((route) => route.id)).toEqual([
      "dashboard",
      "attendance",
      "store",
    ]);
    expect(canAccessRoute("store_staff", "catalog")).toBe(false);
    expect(canAccessRoute("store_staff", "lab")).toBe(false);
  });

  it("keeps lab staff on lab-facing routes", () => {
    expect(getRoutesForRole("lab_staff").map((route) => route.id)).toEqual([
      "dashboard",
      "attendance",
      "lab",
    ]);
    expect(canAccessRoute("lab_staff", "store")).toBe(false);
    expect(canAccessRoute("lab_staff", "staff")).toBe(false);
  });

  it("starts each role on the dashboard", () => {
    expect(getDefaultRouteForRole("admin")).toBe("dashboard");
    expect(getDefaultRouteForRole("store_manager")).toBe("dashboard");
    expect(getDefaultRouteForRole("lab_manager")).toBe("dashboard");
  });

  it("maps dashboard cards to persona routes", () => {
    expect(getCardTargetRoute("dashboard", "admin", "Catalog setup")).toBe("catalog");
    expect(getCardTargetRoute("dashboard", "admin", "Staff roster")).toBe("staff");
    expect(getCardTargetRoute("dashboard", "admin", "Review")).toBe("review");
    expect(getCardTargetRoute("dashboard", "store_staff", "Check in")).toBe("attendance");
    expect(getCardTargetRoute("dashboard", "store_staff", "Move to display")).toBe("store");
    expect(getCardTargetRoute("dashboard", "lab_staff", "Production entry")).toBe("lab");
  });
});
