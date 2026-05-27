import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffProfile } from "../../domain/roles";
import { renderApp, screen, userEvent, waitFor } from "../../test/render";
import { AuthProvider, useAuth } from "./AuthProvider";

const adminProfile: StaffProfile = {
  id: "admin-user",
  authUserId: "auth-admin",
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
};

const staffApiMock = vi.hoisted(() => ({
  getCurrentStaffProfile: vi.fn(),
  getDemoStaffByRole: vi.fn(),
  loginWithPhone: vi.fn(),
  signOutStaff: vi.fn(),
}));

vi.mock("../admin/staff/staffApi", () => staffApiMock);

function AuthProbe() {
  const { error, loading, profile, signOut } = useAuth();

  return (
    <div>
      <div>loading:{String(loading)}</div>
      <div>profile:{profile?.name ?? "none"}</div>
      <div>error:{error ?? "none"}</div>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    staffApiMock.getCurrentStaffProfile.mockResolvedValue(null);
    staffApiMock.getDemoStaffByRole.mockReturnValue(adminProfile);
    staffApiMock.loginWithPhone.mockResolvedValue(adminProfile);
    staffApiMock.signOutStaff.mockResolvedValue(undefined);
  });

  it("restores a Supabase staff profile on mount", async () => {
    staffApiMock.getCurrentStaffProfile.mockResolvedValue(adminProfile);

    renderApp(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading:true")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("profile:Arjun Sharma")).toBeInTheDocument());
    expect(screen.getByText("loading:false")).toBeInTheDocument();
    expect(staffApiMock.getCurrentStaffProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps the user signed out when no Supabase session exists", async () => {
    renderApp(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("loading:false")).toBeInTheDocument());
    expect(screen.getByText("profile:none")).toBeInTheDocument();
    expect(screen.getByText("error:none")).toBeInTheDocument();
  });

  it("clears the restored profile on sign out", async () => {
    staffApiMock.getCurrentStaffProfile.mockResolvedValue(adminProfile);
    const user = userEvent.setup();

    renderApp(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("profile:Arjun Sharma")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.getByText("profile:none")).toBeInTheDocument());
    expect(staffApiMock.signOutStaff).toHaveBeenCalledTimes(1);
  });

  it("shows a restore error when the Supabase profile is inactive or missing", async () => {
    staffApiMock.getCurrentStaffProfile.mockRejectedValue(
      new Error("Signed-in account is not active in Snowy Owl Operations."),
    );

    renderApp(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("error:Signed-in account is not active in Snowy Owl Operations.")).toBeInTheDocument(),
    );
    expect(screen.getByText("profile:none")).toBeInTheDocument();
  });
});
