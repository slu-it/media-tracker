/*
 * Frontend mirror of the backend value object (auth/domain's `NewPassword`). Returns an error CODE (an i18n key
 * under `validation.*`), never a translated string, so this module stays free of React and i18n; see
 * games/domain/gameValues.ts for the same pattern.
 */

/** Mirrors `NewPassword.MIN_LENGTH` (backend). */
export const PASSWORD_MIN_LENGTH = 8;

/** Mirrors `NewPassword.MAX_LENGTH` (backend); above it the backend answers 400 `validation_error`. */
export const PASSWORD_MAX_LENGTH = 1024;

export type ValidationCode = "required" | "tooShort" | "tooLong" | "mismatch";

/** The current password is only required here; the backend is the one that knows whether it is actually right. */
export function validateCurrentPassword(value: string): ValidationCode | null {
  return value.length === 0 ? "required" : null;
}

/** Mirrors `NewPassword`'s rule: non-empty and between `PASSWORD_MIN_LENGTH` and `PASSWORD_MAX_LENGTH` characters. */
export function validateNewPassword(value: string): ValidationCode | null {
  if (value.length === 0) return "required";
  if (value.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (value.length > PASSWORD_MAX_LENGTH) return "tooLong";
  return null;
}

/** The confirmation field: required, and must match `newPassword` exactly. */
export function validatePasswordConfirmation(newPassword: string, confirmation: string): ValidationCode | null {
  if (confirmation.length === 0) return "required";
  if (confirmation !== newPassword) return "mismatch";
  return null;
}
