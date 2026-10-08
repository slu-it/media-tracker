import { describe, expect, it } from "vitest";
import { validatePlatformIds, validateRating } from "./gameValues";

describe("gameValues", () => {
  it("requires at least one platform", () => {
    expect(validatePlatformIds([])).toBe("required");
    expect(validatePlatformIds(["platform-1"])).toBeNull();
    expect(validatePlatformIds(["platform-1", "platform-2"])).toBeNull();
  });

  it("treats the rating as optional but bounded and stepped", () => {
    expect(validateRating(null)).toBeNull();
    expect(validateRating(0.25)).toBeNull();
    expect(validateRating(5)).toBeNull();
    expect(validateRating(3.5)).toBeNull();
    expect(validateRating(0)).toBe("invalidRating");
    expect(validateRating(5.25)).toBe("invalidRating");
    expect(validateRating(0.1)).toBe("invalidRating");
    expect(validateRating(3.0000000001)).toBe("invalidRating");
    expect(validateRating(NaN)).toBe("invalidRating");
    expect(validateRating(Infinity)).toBe("invalidRating");
    expect(validateRating(-Infinity)).toBe("invalidRating");
  });
});
