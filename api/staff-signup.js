import { createClient } from "@supabase/supabase-js";

const allowedRoles = new Set(["store_manager", "lab_manager", "store_staff", "lab_staff"]);

function staffEmail(phone) {
  return `staff-${phone}@snowyowlgelato.com`;
}

function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

function send(response, status, body) {
  response.status(status).json(body);
}

function publicStaffProfile(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id ?? null,
    name: row.name,
    phone: row.phone ?? "",
    role: row.role,
    defaultLocationId: row.default_location_id ?? null,
    salaryAmount: row.salary_amount === null || row.salary_amount === undefined ? null : Number(row.salary_amount),
    salaryType: row.salary_type ?? null,
    allowedHolidaysPerMonth: Number(row.allowed_holidays_per_month ?? 0),
    bonusDaysBalance: 0,
    active: Boolean(row.active),
    signupStatus: row.signup_status ?? "pending",
  };
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  return null;
}

async function getOrCreateAuthUser(supabase, input) {
  const email = staffEmail(input.phone);
  const metadata = {
    name: input.name,
    phone: input.phone,
    role: input.role,
    defaultLocationId: input.defaultLocationId,
  };

  let authUser = await findAuthUserByEmail(supabase, email);

  if (authUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error) {
    return data.user;
  }

  const possibleExistingUser = await findAuthUserByEmail(supabase, email);
  if (possibleExistingUser) {
    return possibleExistingUser;
  }

  throw error;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    send(response, 405, { error: "Method not allowed." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    send(response, 500, { error: "Staff signup service is not configured." });
    return;
  }

  const input = {
    name: String(request.body?.name ?? "").trim(),
    phone: normalizePhone(request.body?.phone),
    password: String(request.body?.password ?? ""),
    role: String(request.body?.role ?? "store_staff"),
    defaultLocationId: request.body?.defaultLocationId ? String(request.body.defaultLocationId) : null,
  };

  if (!input.name) {
    send(response, 400, { error: "Enter the staff member's name." });
    return;
  }

  if (!/^[0-9]{10}$/.test(input.phone)) {
    send(response, 400, { error: "Enter a 10-digit mobile number." });
    return;
  }

  if (input.password.length < 6) {
    send(response, 400, { error: "Password must be at least 6 characters." });
    return;
  }

  if (!allowedRoles.has(input.role)) {
    send(response, 400, { error: "Choose a valid staff role." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: existingStaff, error: staffLookupError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", input.phone)
      .maybeSingle();

    if (staffLookupError) {
      throw staffLookupError;
    }

    if (existingStaff?.role === "admin") {
      send(response, 409, { error: "This phone number cannot request staff access." });
      return;
    }

    if (existingStaff?.active || existingStaff?.signup_status === "approved") {
      send(response, 409, { error: "A staff login already exists for this phone." });
      return;
    }

    let locationId = null;
    if (input.defaultLocationId) {
      const { data: location, error: locationError } = await supabase
        .from("locations")
        .select("id")
        .eq("id", input.defaultLocationId)
        .eq("active", true)
        .maybeSingle();

      if (locationError) {
        throw locationError;
      }

      locationId = location?.id ?? null;
    }

    let authUser = null;
    if (existingStaff?.auth_user_id) {
      const { data, error } = await supabase.auth.admin.updateUserById(existingStaff.auth_user_id, {
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          phone: input.phone,
          role: input.role,
          defaultLocationId: locationId,
        },
      });

      if (error) {
        throw error;
      }

      authUser = data.user;
    } else {
      authUser = await getOrCreateAuthUser(supabase, { ...input, defaultLocationId: locationId });
    }

    if (!authUser?.id) {
      send(response, 500, { error: "Unable to create staff login." });
      return;
    }

    const payload = {
      auth_user_id: authUser.id,
      name: input.name,
      phone: input.phone,
      role: input.role,
      default_location_id: locationId,
      salary_amount: null,
      salary_type: "daily",
      allowed_holidays_per_month: 0,
      active: false,
      signup_status: "pending",
      signup_requested_at: new Date().toISOString(),
      approved_at: null,
      rejected_at: null,
    };

    const query = existingStaff
      ? supabase.from("users").update(payload).eq("id", existingStaff.id).select().single()
      : supabase.from("users").insert(payload).select().single();

    const { data: staff, error: saveError } = await query;

    if (saveError) {
      throw saveError;
    }

    send(response, 200, { staff: publicStaffProfile(staff) });
  } catch (error) {
    send(response, 500, {
      error: error instanceof Error ? error.message : "Unable to submit staff signup.",
    });
  }
}
