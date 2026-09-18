import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLocalStorageState } from "./useLocalStorageState";

const isColor = (raw: string): raw is "red" | "blue" => raw === "red" || raw === "blue";

describe("useLocalStorageState", () => {
  it("reads a valid stored value", () => {
    localStorage.setItem("color", "blue");
    const { result } = renderHook(() => useLocalStorageState("color", "red", isColor));
    expect(result.current[0]).toBe("blue");
  });

  it("ignores an invalid stored value and uses the fallback", () => {
    localStorage.setItem("color", "green");
    const { result } = renderHook(() => useLocalStorageState("color", "red", isColor));
    expect(result.current[0]).toBe("red");
  });

  it("persists on set", () => {
    const { result } = renderHook(() => useLocalStorageState("color", "red", isColor));
    act(() => result.current[1]("blue"));
    expect(result.current[0]).toBe("blue");
    expect(localStorage.getItem("color")).toBe("blue");
  });

  it("falls back to plain state when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useLocalStorageState("color", "red", isColor));
    expect(result.current[0]).toBe("red");
    act(() => result.current[1]("blue"));
    expect(result.current[0]).toBe("blue");
  });
});
