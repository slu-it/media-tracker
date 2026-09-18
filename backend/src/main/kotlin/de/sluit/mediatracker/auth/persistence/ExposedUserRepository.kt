package de.sluit.mediatracker.auth.persistence

import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.auth.domain.UserRepository
import de.sluit.mediatracker.common.persistence.dbQuery
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.time.Clock

class ExposedUserRepository : UserRepository {
    override suspend fun findByUsername(username: String): User? = dbQuery { findByUsernameBlocking(username) }

    /** Blocking variant for use inside an existing transaction (bootstrap CLI, tests). */
    fun findByUsernameBlocking(username: String): User? =
        UsersTable.selectAll().where { UsersTable.username eq username }.singleOrNull()?.toUser()

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
