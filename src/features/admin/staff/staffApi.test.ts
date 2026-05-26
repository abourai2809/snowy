import { afterEach, describe, expect, it, vi } from "vitest";

describe("staffApi Supabase signup", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../../lib/supabase");
  });

  it("submits signup even when Supabase does not return a user id", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: null,
    });

    vi.doMock("../../../lib/supabase", () => ({
      isSupabaseConfigured: true,
      requireSupabaseClient: () => ({
        auth: {
          signUp,
          signOut: vi.fn(),
        },
      }),
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
      id: "9000004444",
      authUserId: null,
      name: "New Staff Member",
      phone: "9000004444",
      active: false,
      signupStatus: "pending",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "staff-9000004444@snowyowlgelato.com",
      password: "secret1",
      options: {
        data: {
          name: "New Staff Member",
          phone: "9000004444",
          role: "store_staff",
          defaultLocationId: "rajpur",
        },
      },
    });
  });
});
