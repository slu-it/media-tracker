import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { useLoadOnce } from "./useLoadOnce";

describe("useLoadOnce", () => {
  it("loads once on mount and again on reload", async () => {
    const load = vi.fn(() => Promise.resolve("value"));
    const { result } = renderHook(() => useLoadOnce(load, "load failed"));
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe("value"));
    expect(load).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("reports the error text on failure and clears it after a successful reload", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("value");
    const { result } = renderHook(() => useLoadOnce(load, "load failed"));
    await waitFor(() => expect(result.current.error).toBe("load failed"));
    expect(result.current.data).toBeNull();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe("value"));
    expect(result.current.error).toBeNull();
  });
});
