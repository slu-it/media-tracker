package de.sluit.mediatracker.auth.persistence

import de.sluit.mediatracker.auth.domain.ApiKey
import de.sluit.mediatracker.auth.domain.ApiKeySlot
import de.sluit.mediatracker.auth.domain.ApiKeys
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.auth.domain.UserRepository
import de.sluit.mediatracker.common.persistence.dbQuery
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.time.Clock

class ExposedUserRepository : UserRepository {
    override suspend fun findByUsername(username: String): User? = dbQuery { findByUsernameBlocking(username) }

    /** Blocking variant for use inside an existing transaction (bootstrap CLI, tests). */
    fun findByUsernameBlocking(username: String): User? =
        UsersTable.selectAll().where { UsersTable.username eq username }.singleOrNull()?.toUser()

    override suspend fun findApiKeys(userId: Long): ApiKeys? = dbQuery {
        UsersTable.selectAll().where { UsersTable.id eq userId }.singleOrNull()?.let {
            ApiKeys(
                primary = it[UsersTable.primaryApiKey]?.let { raw -> ApiKey.parseOrNull(raw) },
                secondary = it[UsersTable.secondaryApiKey]?.let { raw -> ApiKey.parseOrNull(raw) },
            )
        }
    }

    override suspend fun saveApiKey(userId: Long, slot: ApiKeySlot, key: ApiKey): Boolean = dbQuery {
        val updated = UsersTable.update({ UsersTable.id eq userId }) {
            when (slot) {
                ApiKeySlot.PRIMARY -> it[primaryApiKey] = key.toString()
                ApiKeySlot.SECONDARY -> it[secondaryApiKey] = key.toString()
            }
        }
        updated == 1
    }

    override suspend fun findByApiKey(key: ApiKey): User? = dbQuery {
        val raw = key.toString()
        // A key can theoretically match two users' different slots; degrade to "first match" instead of a 500.
        UsersTable.selectAll()
            .where { (UsersTable.primaryApiKey eq raw) or (UsersTable.secondaryApiKey eq raw) }
            .limit(1)
            .firstOrNull()
            ?.toUser()
    }

    fun createBlocking(username: String, passwordHash: String): Long = UsersTable.insert {
        it[UsersTable.username] = username
        it[UsersTable.passwordHash] = passwordHash
        it[createdAt] = Clock.System.now()
    }[UsersTable.id]

    fun updatePasswordBlocking(userId: Long, passwordHash: String): Int =
        UsersTable.update({ UsersTable.id eq userId }) { it[UsersTable.passwordHash] = passwordHash }

    private fun ResultRow.toUser() = User(
        id = this[UsersTable.id],
        username = this[UsersTable.username],
        passwordHash = this[UsersTable.passwordHash],
    )
}
