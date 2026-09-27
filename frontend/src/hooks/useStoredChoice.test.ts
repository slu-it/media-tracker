import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStoredChoice } from "./useStoredChoice";

const COLORS = ["red", "blue"] as const;
type Color = (typeof COLORS)[number];

describe("useStoredChoice", () => {
  it("reads a valid stored value", () => {
    localStorage.setItem("color", "blue");
    const { result } = renderHook(() => useStoredChoice<Color>("color", COLORS, "red"));
    expect(result.current[0]).toBe("blue");
  });

  it("ignores an invalid stored value and uses the fallback", () => {
    localStorage.setItem("color", "green");
    const { result } = renderHook(() => useStoredChoice<Color>("color", COLORS, "red"));
    expect(result.current[0]).toBe("red");
  });

  it("persists on set", () => {
    const { result } = renderHook(() => useStoredChoice<Color>("color", COLORS, "red"));
    act(() => result.current[1]("blue"));
    expect(result.current[0]).toBe("blue");
    expect(localStorage.getItem("color")).toBe("blue");
  });
});
