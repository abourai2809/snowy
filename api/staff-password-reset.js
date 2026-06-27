import { createClient } from "@supabase/supabase-js";

function staffEmail(phone) {
  return `staff-${phone}@snowyowlgelato.com`;
}

function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

function send(response, status, body) {
  response.status(status).json(body);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function responseStatus(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
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
    requiredHoursPerDay: Number(row.required_hours_per_day ?? 8),
    allowedHolidaysPerMonth: Number(row.allowed_holidays_per_month ?? 0),
    bonusDaysBalance: 0,
    active: Boolean(row.active),
    signupStatus: row.signup_status ?? "approved",
  };
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization ?? "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
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

async function getAdminProfile(supabase, token) {
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.id) {
    throw httpError(401, "Admin login is required.");
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("users")
    .select("id, role, active, signup_status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    throw adminError;
  }

  if (!adminProfile || adminProfile.role !== "admin" || !adminProfile.active || adminProfile.signup_status !== "approved") {
    throw httpError(403, "Only Admin can reset staff passwords.");
  }

  return adminProfile;
}

async function getOrCreateTargetAuthUser(supabase, staff, password) {
  const phone = normalizePhone(staff.phone);
  const email = staffEmail(phone);
  const metadata = {
    name: staff.name,
    phone,
    role: staff.role,
    defaultLocationId: staff.default_location_id ?? null,
  };

  if (staff.auth_user_id) {
    const { data, error } = await supabase.auth.admin.updateUserById(staff.auth_user_id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const existingAuthUser = await findAuthUserByEmail(supabase, email);
  if (existingAuthUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
      password,
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
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error) {
    throw error;
  }

  return data.user;
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
    send(response, 500, { error: "Staff password reset service is not configured." });
    return;
  }

  const token = bearerToken(request);
  if (!token) {
    send(response, 401, { error: "Admin login is required." });
    return;
  }

  const input = {
    staffId: String(request.body?.staffId ?? ""),
    password: String(request.body?.password ?? ""),
  };

  if (!input.staffId) {
    send(response, 400, { error: "Choose a staff member." });
    return;
  }

  if (input.password.length < 6) {
    send(response, 400, { error: "Password must be at least 6 characters." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const adminProfile = await getAdminProfile(supabase, token);
    const { data: staff, error: staffError } = await supabase
      .from("users")
      .select("*")
      .eq("id", input.staffId)
      .maybeSingle();

    if (staffError) {
      throw staffError;
    }

    if (!staff) {
      send(response, 404, { error: "Staff member not found." });
      return;
    }

    if (staff.role === "admin") {
      send(response, 400, { error: "Admin passwords must be reset outside the staff roster." });
      return;
    }

    if (staff.signup_status !== "approved") {
      send(response, 400, { error: "Only approved staff can receive an Admin password reset." });
      return;
    }

    const authUser = await getOrCreateTargetAuthUser(supabase, staff, input.password);
    if (!authUser?.id) {
      send(response, 500, { error: "Unable to reset staff password." });
      return;
    }

    const { data: updatedStaff, error: updateError } = await supabase
      .from("users")
      .update({
        auth_user_id: authUser.id,
        password_reset_requested_by: adminProfile.id,
        password_reset_requested_at: new Date().toISOString(),
      })
      .eq("id", staff.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    send(response, 200, { staff: publicStaffProfile(updatedStaff) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset staff password.";
    send(response, responseStatus(error), { error: message });
  }
}
