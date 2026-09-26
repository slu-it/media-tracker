import { describe, expect, it } from "vitest";
import { AUTHORIZATION_CODE_MAX_LENGTH, validateAuthorizationCode } from "./dropboxValues";

describe("validateAuthorizationCode", () => {
  it("requires a non-blank code", () => {
    expect(validateAuthorizationCode("")).toBe("required");
    expect(validateAuthorizationCode("   ")).toBe("required");
  });

  it("accepts a plausible code", () => {
    expect(validateAuthorizationCode("abc123")).toBeNull();
  });

  it("rejects a code longer than the max length", () => {
    expect(validateAuthorizationCode("a".repeat(AUTHORIZATION_CODE_MAX_LENGTH))).toBeNull();
    expect(validateAuthorizationCode("a".repeat(AUTHORIZATION_CODE_MAX_LENGTH + 1))).toBe("tooLong");
  });

  it("accepts a max-length code padded with whitespace, since the backend trims before validating", () => {
    const padded = `  ${"a".repeat(AUTHORIZATION_CODE_MAX_LENGTH)}  `;
    expect(validateAuthorizationCode(padded)).toBeNull();
  });
});
