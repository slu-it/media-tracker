import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MODE_STORAGE_KEY } from "../../theme/mode";
import { ThemeModeToggle } from "./ThemeModeToggle";

describe("ThemeModeToggle", () => {
  it("starts on a light OS preference, offering the switch to dark", () => {
    renderWithProviders(<ThemeModeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBeNull();
  });

  it("starts on a dark OS preference, offering the switch to light", () => {
    // test-setup.ts stubs matchMedia to always report matches: false, so this test overrides it with a stub
    // that reports the dark-mode media query as matching, mirroring the shape of the default stub.
    // vi.stubGlobal is not undone by test-setup.ts's vi.restoreAllMocks() (that only restores vi.spyOn spies),
    // so this test restores it itself.
    vi.stubGlobal(
      "matchMedia",
      (query: string): MediaQueryList =>
        ({
          matches: query === "(prefers-color-scheme: dark)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    try {
      renderWithProviders(<ThemeModeToggle />);
      expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
      expect(localStorage.getItem(MODE_STORAGE_KEY)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("switches the app to dark on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeModeToggle />);
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("persists the choice under the key the login page shares", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeModeToggle />);
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    // The literal "mt.mode" is what backend/src/main/resources/login/login.html hard-codes, so the two ends
    // cannot drift apart; AuthRoutesTest pins the backend side of the same string.
    expect(localStorage.getItem("mt.mode")).toBe("dark");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("dark");
  });

  it("switches back to light on a second click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeModeToggle />);
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("light");
  });
});
