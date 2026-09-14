package de.sluit.mediatracker.auth

import de.sluit.mediatracker.db.Users
import de.sluit.mediatracker.db.dbQuery
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.time.Clock

data class User(val id: Long, val username: String, val passwordHash: String)

class UserRepository {
    suspend fun findByUsername(username: String): User? = dbQuery { findByUsernameBlocking(username) }

    /** Blocking variant for use inside an existing transaction (bootstrap CLI, tests). */
    fun findByUsernameBlocking(username: String): User? =
        Users.selectAll().where { Users.username eq username }.singleOrNull()?.toUser()

    fun createBlocking(username: String, passwordHash: String): Long = Users.insert {
        it[Users.username] = username
        it[Users.passwordHash] = passwordHash
        it[createdAt] = Clock.System.now()
    }[Users.id]

    fun updatePasswordBlocking(userId: Long, passwordHash: String): Int =
        Users.update({ Users.id eq userId }) { it[Users.passwordHash] = passwordHash }

    private fun ResultRow.toUser() = User(
        id = this[Users.id],
        username = this[Users.username],
        passwordHash = this[Users.passwordHash],
    )
}
