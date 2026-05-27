export const APP_ROLES = [
  "admin",
  "store_manager",
  "lab_manager",
  "store_staff",
  "lab_staff",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type SalaryType = "monthly" | "daily";
export type StaffSignupStatus = "approved" | "pending" | "rejected";

export interface LocationOption {
  id: string;
  name: string;
  type: "lab" | "store";
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  attendanceRadiusM: number;
  attendanceAccuracyLimitM: number;
  posAlias?: string | null;
}

export interface StaffProfile {
  id: string;
  authUserId?: string | null;
  name: string;
  phone: string;
  role: AppRole;
  defaultLocationId: string | null;
  salaryAmount: number | null;
  salaryType: SalaryType | null;
  requiredHoursPerDay: number;
  allowedHolidaysPerMonth: number;
  bonusDaysBalance: number;
  active: boolean;
  signupStatus?: StaffSignupStatus;
}

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

export function canManageStaff(role: AppRole): boolean {
  return role === "admin";
}
