package de.sluit.mediatracker.auth.domain

import kotlin.time.Instant

data class StoredSession(val id: String, val userId: Long, val username: String, val expiresAt: Instant)

/**
 * Persistence port of the auth domain's sessions. Implemented in `auth.persistence`; the domain never
 * imports that package, so dependencies point inward only.
 */
interface SessionRepository {
    /** Creates or replaces the session row; Ktor may store the same id more than once per call. */
    suspend fun save(id: String, userId: Long, expiresAt: Instant)

    /** Returns the session joined with its user, or null when unknown. Expiry is checked by the caller. */
    suspend fun find(id: String): StoredSession?

    suspend fun delete(id: String): Int
}
