import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateCurrentPassword,
  validateNewPassword,
  validatePasswordConfirmation,
} from "./passwordValues";

describe("validateCurrentPassword", () => {
  it("requires a non-empty value", () => {
    expect(validateCurrentPassword("")).toBe("required");
  });

  it("accepts any non-empty value, even a short one", () => {
    expect(validateCurrentPassword("a")).toBeNull();
  });
});

describe("validateNewPassword", () => {
  it("requires a non-empty value", () => {
    expect(validateNewPassword("")).toBe("required");
  });

  it("rejects a password shorter than the minimum length", () => {
    expect(validateNewPassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe("tooShort");
  });

  it("accepts a password of exactly the minimum length", () => {
    expect(validateNewPassword("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it("accepts a password of exactly the maximum length", () => {
    expect(validateNewPassword("a".repeat(PASSWORD_MAX_LENGTH))).toBeNull();
  });

  it("rejects a password longer than the maximum length", () => {
    expect(validateNewPassword("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe("tooLong");
  });
});

describe("validatePasswordConfirmation", () => {
  it("requires a non-empty confirmation", () => {
    expect(validatePasswordConfirmation("secret123", "")).toBe("required");
  });

  it("rejects a confirmation that does not match the new password", () => {
    expect(validatePasswordConfirmation("secret123", "secret124")).toBe("mismatch");
  });

  it("accepts a confirmation matching the new password exactly", () => {
    expect(validatePasswordConfirmation("secret123", "secret123")).toBeNull();
  });
});
