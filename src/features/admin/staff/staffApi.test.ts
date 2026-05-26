import { afterEach, describe, expect, it, vi } from "vitest";

describe("staffApi Supabase signup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("../../../lib/supabase");
  });

  it("submits signup through the server endpoint so Supabase does not send auth emails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          staff: {
            id: "staff-1",
            authUserId: "auth-1",
            name: "New Staff Member",
            phone: "9000004444",
            role: "store_staff",
            defaultLocationId: "rajpur",
            salaryAmount: null,
            salaryType: "daily",
            allowedHolidaysPerMonth: 0,
            bonusDaysBalance: 0,
            active: false,
            signupStatus: "pending",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("../../../lib/supabase", () => ({
      isSupabaseConfigured: true,
      requireSupabaseClient: vi.fn(),
    }));

    const { requestStaffSignup } = await import("./staffApi");

    await expect(
      requestStaffSignup({
        name: "New Staff Member",
        phone: "9000004444",
        password: "secret1",
        role: "store_staff",
        defaultLocationId: "rajpur",
      }),
    ).resolves.toMatchObject({
      id: "staff-1",
      authUserId: "auth-1",
      name: "New Staff Member",
      phone: "9000004444",
      active: false,
      signupStatus: "pending",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/staff-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "New Staff Member",
        phone: "9000004444",
        password: "secret1",
        role: "store_staff",
        defaultLocationId: "rajpur",
      }),
    });
  });

  it("shows the server signup error when staff signup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "A staff login already exists for this phone." }), {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    vi.doMock("../../../lib/supabase", () => ({
      isSupabaseConfigured: true,
      requireSupabaseClient: vi.fn(),
    }));

    const { requestStaffSignup } = await import("./staffApi");

    await expect(
      requestStaffSignup({
        name: "Existing Staff Member",
        phone: "9000004444",
        password: "secret1",
        role: "store_staff",
        defaultLocationId: "rajpur",
      }),
    ).rejects.toThrow("A staff login already exists for this phone.");
  });
});
