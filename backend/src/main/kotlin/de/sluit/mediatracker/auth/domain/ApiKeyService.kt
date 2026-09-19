package de.sluit.mediatracker.auth.domain

import de.sluit.mediatracker.common.domain.NotFoundException
import org.slf4j.LoggerFactory

class ApiKeyService(private val users: UserRepository) {
    private val log = LoggerFactory.getLogger(ApiKeyService::class.java)

    /** The user's current API keys. Throws [NotFoundException] if no such user exists. */
    suspend fun keysFor(userId: Long): ApiKeys =
        users.findApiKeys(userId) ?: throw NotFoundException("user", userId.toString())

    /** Generates a new key for [slot] and stores it. Throws [NotFoundException] if no such user exists. */
    suspend fun regenerate(userId: Long, slot: ApiKeySlot): ApiKeys {
        val key = ApiKey.generate()
        val saved = users.saveApiKey(userId, slot, key)
        if (!saved) throw NotFoundException("user", userId.toString())
        return keysFor(userId)
    }

    /**
     * Authenticates [rawKey] against the stored keys. Returns the matching user, or null if [rawKey] is not a
     * valid key shape or matches no user (never reveals which, and never logs the key value itself).
     */
    suspend fun authenticate(rawKey: String): User? {
        val key = ApiKey.parseOrNull(rawKey)
        if (key == null) {
            log.debug("Rejected API key: malformed")
            return null
        }
        val user = users.findByApiKey(key)
        if (user == null) {
            log.debug("Rejected API key: no matching user")
        }
        return user
    }
}
