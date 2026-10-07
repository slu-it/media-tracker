package de.sluit.mediatracker.auth.domain

import de.sluit.mediatracker.common.domain.WrongPasswordException
import org.slf4j.LoggerFactory

class AuthService(
    private val users: UserRepository,
    private val hasher: PasswordHasher,
    private val sessions: SessionRepository,
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    /** Hash verified against when the username is unknown, so both failure paths cost the same. */
    private val dummyHash: String = hasher.hash("not-a-real-password".toCharArray())

    /** Returns the user on success, null on any failure (never reveals which part was wrong). */
    suspend fun login(username: String, password: CharArray): User? {
        val user = users.findByUsername(username.trim())
        val ok = hasher.verify(password, user?.passwordHash ?: dummyHash)
        password.fill('\u0000')
        if (user == null || !ok) {
            log.info("Failed login for '{}'", username.take(64))
            return null
        }
        return user
    }

    /**
     * Self-service password change for the already-authenticated [username] / [userId] (the session principal):
     * verifies [current] against the stored hash (constant time, same as [login]), then signs out every other
     * session of this user, keeping only [keepSessionId] (the caller's own session) alive, and finally stores
     * [new]'s hash.
     *
     * Throws [WrongPasswordException] when [current] does not match, when the looked-up user's id does not match
     * [userId] (the session principal no longer points at the same account), when the user is somehow gone by
     * the time this runs, when [current] is implausibly long (rejected before it ever reaches Argon2, see
     * [NewPassword.MAX_LENGTH]), or when the final write finds the user row gone (never reveals which part was
     * wrong). Only [current] and the array backing [new] are zeroed after use, like [login]: [new] itself is
     * backed by an immutable `String` (see its KDoc), so there is nothing to zero for that.
     */
    suspend fun changePassword(
        username: String,
        userId: Long,
        keepSessionId: String,
        current: CharArray,
        new: NewPassword,
    ) {
        if (current.size > NewPassword.MAX_LENGTH) {
            current.fill('\u0000')
            log.info("Failed password change for '{}': current password too long", username.take(64))
            throw WrongPasswordException()
        }
        val user = users.findByUsername(username.trim())
        val ok = hasher.verify(current, user?.passwordHash ?: dummyHash)
        current.fill('\u0000')
        if (user == null || user.id != userId || !ok) {
            log.info("Failed password change for '{}': wrong current password", username.take(64))
            throw WrongPasswordException()
        }

        // No cross-repository transaction spans these two writes, so order which failure mode a crash between
        // them leaves behind: sessions first, then the password. If the second write never runs, the old
        // password is still valid (the user signs back in, mildly annoying) with every other session already
        // gone; the other order would leave a changed password with stale sessions that still trust it.
        sessions.deleteAllForUserExcept(userId, keepSessionId)
        val newHash = new.toCharArray().let { chars ->
            try {
                hasher.hash(chars)
            } finally {
                chars.fill('\u0000')
            }
        }
        if (!users.updatePassword(userId, newHash)) {
            // The ADR treats a user row gone mid-request the same as a wrong password: both mean "this is no
            // longer a password this caller can prove".
            throw WrongPasswordException()
        }
    }
}
