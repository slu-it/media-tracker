package de.sluit.mediatracker.auth.domain

data class User(val id: Long, val username: String, val passwordHash: String)

/**
 * Persistence port of the auth domain's users. Implemented in `auth.persistence`; the domain never imports
 * that package, so dependencies point inward only.
 */
interface UserRepository {
    suspend fun findByUsername(username: String): User?

    /** The user's current API keys, or null if no such user exists. */
    suspend fun findApiKeys(userId: Long): ApiKeys?

    /** Stores [key] in [slot] for the given user. Returns false if no such user exists. */
    suspend fun saveApiKey(userId: Long, slot: ApiKeySlot, key: ApiKey): Boolean

    /** The user whose primary or secondary key equals [key], or null if it matches neither. */
    suspend fun findByApiKey(key: ApiKey): User?
}
