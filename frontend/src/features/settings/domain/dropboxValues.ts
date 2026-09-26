/*
 * Frontend mirror of the backend value object (dropbox/domain/DropboxValues.kt: `AuthorizationCode`). Returns an
 * error CODE (an i18n key under `validation.*`), never a translated string, so this module stays free of React
 * and i18n; see games/domain/gameValues.ts for the same pattern.
 */

export const AUTHORIZATION_CODE_MAX_LENGTH = 512;

export type ValidationCode = "required" | "tooLong";

/**
 * Mirrors `AuthorizationCode`'s `init` rule: non-blank, at most 512 characters. The backend trims the value
 * before validating it, so the length check here runs on the trimmed value too.
 */
export function validateAuthorizationCode(value: string): ValidationCode | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "required";
  if (trimmed.length > AUTHORIZATION_CODE_MAX_LENGTH) return "tooLong";
  return null;
}
