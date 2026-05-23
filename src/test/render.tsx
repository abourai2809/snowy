import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

export function renderApp(ui: ReactElement, options?: Omit<RenderOptions, "queries">) {
  return render(ui, options);
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
