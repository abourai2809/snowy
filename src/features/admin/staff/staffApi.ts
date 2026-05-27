import { isSupabaseConfigured, requireSupabaseClient } from "../../../lib/supabase";
import type {
  AppRole,
  LocationOption,
  SalaryType,
  StaffProfile,
  StaffSignupStatus,
} from "../../../domain/roles";

interface DemoStaffProfile extends StaffProfile {
  password: string;
}

const demoLocations: LocationOption[] = [
  {
    id: "lab",
    name: "Lab / Kitchen",
    type: "lab",
    active: true,
    latitude: 30.2932355,
    longitude: 78.0603935,
    attendanceRadiusM: 150,
    attendanceAccuracyLimitM: 100,
  },
  {
    id: "rajpur",
    name: "Rajpur Road",
    type: "store",
    active: true,
    latitude: 30.3423856,
    longitude: 78.0611274,
    attendanceRadiusM: 150,
    attendanceAccuracyLimitM: 100,
  },
  {
    id: "malsi",
    name: "Malsi",
    type: "store",
    active: true,
    latitude: 30.394992,
    longitude: 78.0748199,
    attendanceRadiusM: 150,
    attendanceAccuracyLimitM: 100,
    posAlias: "Snowy Owl Cottage",
  },
  {
    id: "mussoorie",
    name: "Mussoorie",
    type: "store",
    active: true,
    latitude: 30.4552185,
    longitude: 78.0811381,
    attendanceRadiusM: 150,
    attendanceAccuracyLimitM: 100,
  },
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
    requiredHoursPerDay: 8,
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    signupStatus: "approved",
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
    requiredHoursPerDay: 8,
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    signupStatus: "approved",
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
    requiredHoursPerDay: 8,
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    signupStatus: "approved",
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
    requiredHoursPerDay: 8,
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    signupStatus: "approved",
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
    requiredHoursPerDay: 8,
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    signupStatus: "approved",
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
    requiredHoursPerDay: 8,
    allowedHolidaysPerMonth: 0,
    bonusDaysBalance: 0,
    active: true,
    signupStatus: "approved",
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
    requiredHoursPerDay: Number(row.required_hours_per_day ?? 8),
    allowedHolidaysPerMonth: Number(row.allowed_holidays_per_month ?? 0),
    bonusDaysBalance,
    active: Boolean(row.active),
    signupStatus: (row.signup_status ?? "approved") as StaffSignupStatus,
  };
}

async function getStaffProfileByAuthUserId(authUserId: string): Promise<StaffProfile> {
  const { data, error } = await requireSupabaseClient()
    .from("users")
    .select("*, holiday_policies(bonus_days_balance)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    await signOutStaff();
    throw new Error("Signed-in account is not registered in Snowy Owl Operations.");
  }

  const policies = data.holiday_policies as Array<{ bonus_days_balance?: number }> | null;
  const profile = mapUserRow(data, Number(policies?.[0]?.bonus_days_balance ?? 0));

  if (profile.signupStatus === "pending") {
    await signOutStaff();
    throw new Error("Signup is waiting for Admin approval.");
  }

  if (profile.signupStatus === "rejected") {
    await signOutStaff();
    throw new Error("Signup was rejected. Ask Admin to review your access.");
  }

  if (!profile.active) {
    await signOutStaff();
    throw new Error("Signed-in account is disabled in Snowy Owl Operations.");
  }

  return profile;
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
  const normalizedPhone = normalizePhone(phone);

  if (!isSupabaseConfigured) {
    const member = demoStaff.find((staff) => staff.phone === normalizedPhone);

    if (!member || member.password !== password) {
      throw new Error("Invalid phone or password.");
    }

    if (member.signupStatus === "pending") {
      throw new Error("Signup is waiting for Admin approval.");
    }

    if (member.signupStatus === "rejected") {
      throw new Error("Signup was rejected. Ask Admin to review your access.");
    }

    if (!member.active) {
      throw new Error("Signed-in account is disabled in Snowy Owl Operations.");
    }

    return stripPassword(member);
  }

  const supabase = requireSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: staffEmail(normalizedPhone),
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
    .select("*")
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
    latitude: location.latitude === null || location.latitude === undefined ? null : Number(location.latitude),
    longitude: location.longitude === null || location.longitude === undefined ? null : Number(location.longitude),
    attendanceRadiusM: Number(location.attendance_radius_m ?? 150),
    attendanceAccuracyLimitM: Number(location.attendance_accuracy_limit_m ?? 100),
    posAlias: location.pos_alias ? String(location.pos_alias) : null,
  }));
}

export interface StaffInput {
  name: string;
  phone: string;
  role: AppRole;
  defaultLocationId: string | null;
  salaryAmount: number | null;
  salaryType: SalaryType | null;
  requiredHoursPerDay: number;
  allowedHolidaysPerMonth: number;
  bonusDaysBalance: number;
}

export interface StaffSignupInput {
  name: string;
  phone: string;
  password: string;
  role: Exclude<AppRole, "admin">;
  defaultLocationId: string | null;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function staffEmail(phone: string) {
  return `staff-${phone}@snowyowlgelato.com`;
}

export async function requestStaffSignup(input: StaffSignupInput): Promise<StaffProfile> {
  const phone = normalizePhone(input.phone);
  const name = input.name.trim();

  if (!name) {
    throw new Error("Enter the staff member's name.");
  }

  if (phone.length !== 10) {
    throw new Error("Enter a 10-digit mobile number.");
  }

  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  if (!isSupabaseConfigured) {
    if (demoStaff.some((staff) => staff.phone === phone)) {
      throw new Error("A staff member with this phone already exists.");
    }

    const created: DemoStaffProfile = {
      id: `staff-signup-${Date.now()}`,
      name,
      phone,
      role: input.role,
      defaultLocationId: input.defaultLocationId,
      salaryAmount: null,
      salaryType: "daily",
      allowedHolidaysPerMonth: 0,
      requiredHoursPerDay: 8,
      bonusDaysBalance: 0,
      active: false,
      signupStatus: "pending",
      password: input.password,
    };
    demoStaff.push(created);
    return stripPassword(created);
  }

  const response = await fetch("/api/staff-signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      phone,
      password: input.password,
      role: input.role,
      defaultLocationId: input.defaultLocationId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as { staff?: StaffProfile; error?: string } | null;

  if (!response.ok || !payload?.staff) {
    throw new Error(payload?.error ?? "Unable to submit staff signup.");
  }

  return payload.staff;
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
      signupStatus: "approved",
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
    required_hours_per_day: input.requiredHoursPerDay,
    signup_status: "approved",
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
    if (active && existing.signupStatus !== "approved") {
      existing.signupStatus = "approved";
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("users")
    .update({
      active,
      ...(active ? { signup_status: "approved", approved_at: new Date().toISOString(), rejected_at: null } : {}),
    })
    .eq("id", staffId);
  if (error) {
    throw error;
  }
}

export async function approveStaffSignup(staffId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoStaff.find((staff) => staff.id === staffId);
    if (!existing) {
      throw new Error("Staff member not found.");
    }

    existing.active = true;
    existing.signupStatus = "approved";
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("users")
    .update({
      active: true,
      signup_status: "approved",
      approved_at: new Date().toISOString(),
      rejected_at: null,
    })
    .eq("id", staffId);

  if (error) {
    throw error;
  }
}

export async function rejectStaffSignup(staffId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoStaff.find((staff) => staff.id === staffId);
    if (!existing) {
      throw new Error("Staff member not found.");
    }

    existing.active = false;
    existing.signupStatus = "rejected";
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("users")
    .update({
      active: false,
      signup_status: "rejected",
      rejected_at: new Date().toISOString(),
    })
    .eq("id", staffId);

  if (error) {
    throw error;
  }
}

export async function updateHolidaySettings(
  staffId: string,
  allowedHolidaysPerMonth: number,
  bonusDaysBalance: number,
  requiredHoursPerDay?: number,
): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoStaff.find((staff) => staff.id === staffId);
    if (!existing) {
      throw new Error("Staff member not found.");
    }

    existing.allowedHolidaysPerMonth = allowedHolidaysPerMonth;
    existing.bonusDaysBalance = bonusDaysBalance;
    if (requiredHoursPerDay !== undefined) {
      existing.requiredHoursPerDay = requiredHoursPerDay;
    }
    return;
  }

  const userPatch: Record<string, number> = {
    allowed_holidays_per_month: allowedHolidaysPerMonth,
  };
  if (requiredHoursPerDay !== undefined) {
    userPatch.required_hours_per_day = requiredHoursPerDay;
  }

  const supabase = requireSupabaseClient();
  const { error: userError } = await supabase
    .from("users")
    .update(userPatch)
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
