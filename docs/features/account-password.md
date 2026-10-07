# Change own password (MT-038)

ADR: [0032](../decisions/0032-self-service-password-change.md). Code: `auth/domain/{NewPassword,AuthService}.kt`,
`auth/api/PasswordRoutes.kt` (`ChangePasswordRequest` in `AuthDtos.kt`), `WrongPasswordException` in
`common/domain/DomainErrors.kt` (mapped in `plugins/StatusPages.kt`), `frontend/src/features/settings/`
(`components/PasswordTab.tsx`, `components/fields/PasswordField.tsx`, `domain/passwordValues.ts`).

## Behaviour

- The settings dialog opens on its first tab, **Password**, before API keys and Export / Import.
- The form asks for the current password, the new password and the new password again. Each field validates
  itself once touched, all of them on submit. The new password needs 8 to 1024 characters, and both new fields
  must match. Enter submits.
- Success clears the form and shows a confirmation. The current session stays logged in; every other session of
  the user (other browsers, devices) is logged out. API keys keep working.
- A wrong current password is shown on that field. Other failures show an alert.

## API

- `PUT /api/me/password` with `ChangePasswordRequest {currentPassword, newPassword}`, session only,
  `Cache-Control: no-store`.
- 204 on success, 400 `validation_error` for a new password outside 8 to 1024 characters (and `invalid_body`
  for a malformed body), 403 `wrong_password` for a wrong current password (not 401, see the ADR).
- The user is looked up from the session principal and must match its id. The other sessions are deleted
  before the new hash is written, so a failure in between leaves the old password valid.

## Rules shared with the CLI

- `NewPassword` holds the one length rule, 8 to 1024 characters (`MIN_LENGTH`, `MAX_LENGTH`). Its `init` and
  `CreateUser` call the same check, so a new rule reaches both. The frontend mirrors the bounds as
  `PASSWORD_MIN_LENGTH` and `PASSWORD_MAX_LENGTH`. A current password above the maximum is answered as wrong
  without hashing it.
- The new hash is written with the current `PasswordHasher` parameters.
