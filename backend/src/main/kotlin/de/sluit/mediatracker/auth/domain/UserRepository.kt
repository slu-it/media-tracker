package de.sluit.mediatracker.auth.domain

data class User(val id: Long, val username: String, val passwordHash: String)

/**
 * Persistence port of the auth domain's users. Implemented in `auth.persistence`; the domain never imports
 * that package, so dependencies point inward only.
 */
interface UserRepository {
    suspend fun findByUsername(username: String): User?
}
