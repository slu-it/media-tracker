# 0032: Self-service password change that keeps the current session and ends all others

Status: accepted, 2026-10

## Context

A password could only be set with the `CreateUser` CLI (`--reset-password`), which needs shell access to the Pi
and the JAR. A user had no way to change their own password from the app. The minimum length of eight characters
lived only as an inline check in the CLI.

## Decision

- **`PUT /api/me/password`** behind the session, with `{currentPassword, newPassword}`. The current password is
  always required, so a stolen but still open session alone cannot lock the owner out. The confirmation field
  ("new password twice") is a frontend concern only; the server receives the new password once.
- **Answers:**
  - 204: the password was changed.
  - 400 `validation_error`: the new password is shorter than 8 or longer than 1024 characters.
  - 403 `wrong_password`: the current password does not match, and also when the user row is gone. Not 401,
    because the SPA treats every 401 as an expired session and redirects to `/login`. The user would lose the
    dialog instead of seeing the error on the field.
- **The current session survives, every other session of the user is deleted.** The session id comes from
  `call.sessionId<UserSession>()` and is passed into the domain as the one to keep. The session row is not
  re-issued and no cookie is set. Typical reason for a change is a suspected leak; ending the other sessions locks
  out whoever used the old password. API keys are a separate credential and stay untouched.
- **The principal decides whose password changes.** The user is looked up by the session's username and must
  carry the session's user id, otherwise the answer is `wrong_password`.
- **Sessions go first, then the hash.** The two writes are separate transactions in two repositories. Deleting
  the other sessions first means a failure in between leaves the old password valid and the user merely logged
  out elsewhere. The reverse order could leave a changed password with the old sessions still alive.
- **One password rule for CLI and API.** `NewPassword` in `auth/domain` validates 8 to 1024 characters in `init`
  (`requireValid`), and `CreateUser` calls the same check. The upper bound keeps an arbitrarily long body from
  going through Argon2id. A current password above it is answered as wrong without hashing. The frontend mirrors
  both bounds in `features/settings/domain/passwordValues.ts`.
- **Verification reuses the login path:** `PasswordHasher.verify` (constant time), then `PasswordHasher.hash` with
  the current parameters, so a change also upgrades an old hash to today's Argon2id settings.

## Consequences

- A user can rotate their own password without shell access; the CLI stays for the first user and for resets.
- Changing the password logs out every other browser and device. That is intended, but a user changing it from
  the phone has to log in again on the laptop.
- There is no rate limit on wrong current passwords, same as on `/login`. Brute forcing needs a valid session
  first, and every attempt costs an Argon2id verification.
- No password history, no strength rules beyond length, no "must differ from the current one".

## Alternatives considered

- 401 for a wrong current password: semantically close, but it collides with the SPA's global session-expiry
  handling.
- 400 `validation_error` for a wrong current password: the frontend would have to tell it apart from a too-short
  password by its message text.
- Keeping all other sessions: simpler, but leaves a leaked session open after the change that was meant to close it.
- Ending all sessions including the current one and sending the user to the login page: safe but needlessly
  disruptive, and explicitly not wanted.
- Rotating the kept session (a new id and cookie for the caller): it would also lock out someone who copied this
  exact cookie, which today survives the change. Not done for now. The cookie is HMAC-signed, `HttpOnly` and
  `SameSite=Lax`, so copying it needs access to the browser itself, and logging out and back in after the change
  gives the same effect by hand. Rotation stays a cheap follow-up if that threat becomes relevant.
- A `password_changed_at` stamp checked on every request instead of deleting rows: needs a migration and a check
  per request for the same effect.
