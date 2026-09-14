package de.sluit.mediatracker.auth

import org.slf4j.LoggerFactory

class AuthService(private val users: UserRepository, private val hasher: PasswordHasher) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    /** Hash verified against when the username is unknown, so both failure paths cost the same. */
    private val dummyHash: String = hasher.hash("not-a-real-password".toCharArray())

    /** Returns the principal on success, null on any failure (never reveals which part was wrong). */
    suspend fun login(username: String, password: CharArray): UserSession? {
        val user = users.findByUsername(username.trim())
        val ok = hasher.verify(password, user?.passwordHash ?: dummyHash)
        password.fill('\u0000')
        if (user == null || !ok) {
            log.info("Failed login for '{}'", username.take(64))
            return null
        }
        return UserSession(user.id, user.username)
    }
}
