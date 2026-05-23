export const APP_ROLES = [
  "admin",
  "store_manager",
  "lab_manager",
  "store_staff",
  "lab_staff",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  store_manager: "Store Manager",
  lab_manager: "Lab Manager",
  store_staff: "Store Staff",
  lab_staff: "Lab Staff",
};

export function isStoreRole(role: AppRole): boolean {
  return role === "store_manager" || role === "store_staff";
}

export function isLabRole(role: AppRole): boolean {
  return role === "lab_manager" || role === "lab_staff";
}
