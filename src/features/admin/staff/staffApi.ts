import { isSupabaseConfigured, requireSupabaseClient } from "../../../lib/supabase";
import type { AppRole, LocationOption, SalaryType, StaffProfile } from "../../../domain/roles";

interface DemoStaffProfile extends StaffProfile {
  password: string;
}

const demoLocations: LocationOption[] = [
  { id: "lab", name: "Lab / Kitchen", type: "lab", active: true },
  { id: "rajpur", name: "Rajpur Road", type: "store", active: true },
  { id: "malsi", name: "Malsi", type: "store", active: true },
  { id: "mussoorie", name: "Mussoorie", type: "store", active: true },
];

const initialDemoStaff: DemoStaffProfile[] = [
  {
    id: "staff-admin",
    name: "Arjun Sharma",
    phone: "9876543210",
    role: "admin",
    defaultLocationId: null,
    salaryAmount: 60000,
    salaryType: "monthly",
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    password: "admin123",
  },
  {
    id: "staff-store-manager",
    name: "Priya Mehta",
    phone: "9812345678",
    role: "store_manager",
    defaultLocationId: "rajpur",
    salaryAmount: 25000,
    salaryType: "monthly",
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    password: "pass123",
  },
  {
    id: "staff-lab-manager",
    name: "Rahul Gupta",
    phone: "9823456789",
    role: "lab_manager",
    defaultLocationId: "lab",
    salaryAmount: 30000,
    salaryType: "monthly",
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    password: "pass123",
  },
  {
    id: "staff-store",
    name: "Sneha Joshi",
    phone: "9834567890",
    role: "store_staff",
    defaultLocationId: "malsi",
    salaryAmount: 800,
    salaryType: "daily",
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    password: "pass123",
  },
  {
    id: "staff-lab",
    name: "Vikram Singh",
    phone: "9845678901",
    role: "lab_staff",
    defaultLocationId: "lab",
    salaryAmount: 700,
    salaryType: "daily",
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    password: "pass123",
  },
  {
    id: "staff-mussoorie-manager",
    name: "Meera Rawat",
    phone: "9856789012",
    role: "store_manager",
    defaultLocationId: "mussoorie",
    salaryAmount: 22000,
    salaryType: "monthly",
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    password: "pass123",
  },
];

let demoStaff: DemoStaffProfile[] = cloneDemoStaff(initialDemoStaff);

function cloneDemoStaff(staff: DemoStaffProfile[]): DemoStaffProfile[] {
  return staff.map((member) => ({ ...member }));
}

function stripPassword(member: DemoStaffProfile): StaffProfile {
  const { password: _password, ...profile } = member;
  return profile;
}

function mapUserRow(row: Record<string, unknown>, bonusDaysBalance = 0): StaffProfile {
  return {
    id: String(row.id),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    name: String(row.name),
    phone: row.phone ? String(row.phone) : "",
    role: row.role as AppRole,
    defaultLocationId: row.default_location_id ? String(row.default_location_id) : null,
    salaryAmount: row.salary_amount === null || row.salary_amount === undefined ? null : Number(row.salary_amount),
    salaryType: row.salary_type as SalaryType | null,
    allowedHolidaysPerMonth: Number(row.allowed_holidays_per_month ?? 0),
    bonusDaysBalance,
    active: Boolean(row.active),
  };
}

async function getStaffProfileByAuthUserId(authUserId: string): Promise<StaffProfile> {
  const { data, error } = await requireSupabaseClient()
    .from("users")
    .select("*, holiday_policies(bonus_days_balance)")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    await signOutStaff();
    throw new Error("Signed-in account is not active in Snowy Owl Operations.");
  }

  const policies = data.holiday_policies as Array<{ bonus_days_balance?: number }> | null;
  return mapUserRow(data, Number(policies?.[0]?.bonus_days_balance ?? 0));
}

export function resetDemoStaffData() {
  demoStaff = cloneDemoStaff(initialDemoStaff);
}

export function getDemoStaffByRole(role: AppRole): StaffProfile {
  const member = demoStaff.find((staff) => staff.role === role && staff.active) ?? demoStaff[0];
  return stripPassword(member);
}

export async function getCurrentStaffProfile(): Promise<StaffProfile | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const authUserId = data.session?.user.id;
  if (!authUserId) {
    return null;
  }

  return getStaffProfileByAuthUserId(authUserId);
}

export async function loginWithPhone(phone: string, password: string): Promise<StaffProfile> {
  if (!isSupabaseConfigured) {
    const member = demoStaff.find((staff) => staff.phone === phone && staff.active);

    if (!member || member.password !== password) {
      throw new Error("Invalid phone or password.");
    }

    return stripPassword(member);
  }

  const supabase = requireSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: `${phone}@snowy-owl.internal`,
    password,
  });

  if (authError) {
    throw authError;
  }

  return getStaffProfileByAuthUserId(authData.user.id);
}

export async function signOutStaff() {
  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await requireSupabaseClient().auth.signOut();
  if (error) {
    throw error;
  }
}

export async function listStaff(): Promise<StaffProfile[]> {
  if (!isSupabaseConfigured) {
    return demoStaff.map(stripPassword);
  }

  const { data, error } = await requireSupabaseClient()
    .from("users")
    .select("*, holiday_policies(bonus_days_balance)")
    .order("name");

  if (error) {
    throw error;
  }

  return data.map((row) => {
    const policies = row.holiday_policies as Array<{ bonus_days_balance?: number }> | null;
    return mapUserRow(row, Number(policies?.[0]?.bonus_days_balance ?? 0));
  });
}

export async function listLocations(): Promise<LocationOption[]> {
  if (!isSupabaseConfigured) {
    return demoLocations;
  }

  const { data, error } = await requireSupabaseClient()
    .from("locations")
    .select("id,name,type,active")
    .eq("active", true)
    .order("name");

  if (error) {
    throw error;
  }

  return data.map((location) => ({
    id: location.id,
    name: location.name,
    type: location.type,
    active: location.active,
  }));
}

export interface StaffInput {
  name: string;
  phone: string;
  role: AppRole;
  defaultLocationId: string | null;
  salaryAmount: number | null;
  salaryType: SalaryType | null;
  allowedHolidaysPerMonth: number;
  bonusDaysBalance: number;
}

export async function saveStaff(input: StaffInput, staffId?: string): Promise<StaffProfile> {
  if (!isSupabaseConfigured) {
    if (staffId) {
      const existing = demoStaff.find((staff) => staff.id === staffId);
      if (!existing) {
        throw new Error("Staff member not found.");
      }

      Object.assign(existing, input);
      return stripPassword(existing);
    }

    if (demoStaff.some((staff) => staff.phone === input.phone)) {
      throw new Error("A staff member with this phone already exists.");
    }

    const created: DemoStaffProfile = {
      ...input,
      id: `staff-${Date.now()}`,
      active: true,
      password: "pass123",
    };
    demoStaff.push(created);
    return stripPassword(created);
  }

  const payload = {
    name: input.name,
    phone: input.phone,
    role: input.role,
    default_location_id: input.defaultLocationId,
    salary_amount: input.salaryAmount,
    salary_type: input.salaryType,
    allowed_holidays_per_month: input.allowedHolidaysPerMonth,
  };

  const query = staffId
    ? requireSupabaseClient().from("users").update(payload).eq("id", staffId).select().single()
    : requireSupabaseClient().from("users").insert(payload).select().single();

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  await updateHolidaySettings(data.id, input.allowedHolidaysPerMonth, input.bonusDaysBalance);
  return mapUserRow(data, input.bonusDaysBalance);
}

export async function setStaffActive(staffId: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoStaff.find((staff) => staff.id === staffId);
    if (!existing) {
      throw new Error("Staff member not found.");
    }

    existing.active = active;
    return;
  }

  const { error } = await requireSupabaseClient().from("users").update({ active }).eq("id", staffId);
  if (error) {
    throw error;
  }
}

export async function updateHolidaySettings(
  staffId: string,
  allowedHolidaysPerMonth: number,
  bonusDaysBalance: number,
): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoStaff.find((staff) => staff.id === staffId);
    if (!existing) {
      throw new Error("Staff member not found.");
    }

    existing.allowedHolidaysPerMonth = allowedHolidaysPerMonth;
    existing.bonusDaysBalance = bonusDaysBalance;
    return;
  }

  const supabase = requireSupabaseClient();
  const { error: userError } = await supabase
    .from("users")
    .update({ allowed_holidays_per_month: allowedHolidaysPerMonth })
    .eq("id", staffId);

  if (userError) {
    throw userError;
  }

  const { data: existingPolicy, error: policyLookupError } = await supabase
    .from("holiday_policies")
    .select("id")
    .eq("user_id", staffId)
    .eq("active", true)
    .maybeSingle();

  if (policyLookupError) {
    throw policyLookupError;
  }

  const policyPayload = {
    user_id: staffId,
    allowed_holidays_per_month: allowedHolidaysPerMonth,
    bonus_days_balance: bonusDaysBalance,
    active: true,
  };

  const { error: policyError } = existingPolicy
    ? await supabase.from("holiday_policies").update(policyPayload).eq("id", existingPolicy.id)
    : await supabase.from("holiday_policies").insert(policyPayload);

  if (policyError) {
    throw policyError;
  }
}
