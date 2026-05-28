import { describe, expect, it, vi } from "vitest";
import type { LocationOption } from "../../domain/roles";
import { renderApp, screen, userEvent } from "../../test/render";
import { LocationValidationGate } from "./LocationValidationGate";

describe("LocationValidationGate", () => {
  it("keeps inputs hidden until store confirmation succeeds", async () => {
    const user = userEvent.setup();

    renderApp(
      <LocationValidationGate location={malsi} workflowName="store supply checklist">
        <label>
          Count quantity
          <input aria-label="Count quantity" />
        </label>
      </LocationValidationGate>,
    );

    expect(screen.queryByLabelText("Count quantity")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Malsi" }));

    expect(await screen.findByText("Location verified for Malsi.")).toBeInTheDocument();
    expect(screen.getByLabelText("Count quantity")).toBeInTheDocument();
  });

  it("shows a mismatch warning before opening inputs", async () => {
    const user = userEvent.setup();
    mockDeviceLocation({ latitude: 30.3423856, longitude: 78.0611274 });

    renderApp(
      <LocationValidationGate location={malsi} workflowName="store supply checklist">
        <label>
          Count quantity
          <input aria-label="Count quantity" />
        </label>
      </LocationValidationGate>,
    );

    await user.click(screen.getByRole("button", { name: "Confirm Malsi" }));

    expect(
      await screen.findByText("Browser location could not verify Malsi. Continue only if you are counting this store."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Count quantity")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue to store supply checklist" }));

    expect(screen.getByLabelText("Count quantity")).toBeInTheDocument();
  });
});

const malsi: LocationOption = {
  id: "malsi",
  name: "Malsi",
  type: "store",
  active: true,
  latitude: 30.394992,
  longitude: 78.0748199,
  attendanceRadiusM: 150,
  attendanceAccuracyLimitM: 100,
};

function mockDeviceLocation(location: { latitude: number; longitude: number }, accuracy = 20) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }),
    },
  });
}
