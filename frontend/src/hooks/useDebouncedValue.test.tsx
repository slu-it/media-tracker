import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hades", 1000));
    expect(result.current[0]).toBe("hades");
  });

  it("adopts a new value only after the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1000), {
      initialProps: { value: "hades" },
    });
    rerender({ value: "celeste" });
    expect(result.current[0]).toBe("hades");

    act(() => vi.advanceTimersByTime(999));
    expect(result.current[0]).toBe("hades");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe("celeste");
  });

  it("restarts the delay on every change so a burst yields one update", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1000), {
      initialProps: { value: "h" },
    });
    rerender({ value: "ha" });
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: "had" });
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: "hades" });
    act(() => vi.advanceTimersByTime(999));
    expect(result.current[0]).toBe("h");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe("hades");
  });

  it("clears the pending timer on unmount", () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 1000), {
      initialProps: { value: "hades" },
    });
    rerender({ value: "celeste" });
    unmount();
    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow();
  });

  it("flush applies the pending value immediately", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1000), {
      initialProps: { value: "hades" },
    });
    rerender({ value: "celeste" });
    act(() => result.current[1]());
    expect(result.current[0]).toBe("celeste");
  });
});
