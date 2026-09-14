package de.sluit.mediatracker.auth

import de.sluit.mediatracker.db.Sessions
import de.sluit.mediatracker.db.Users
import de.sluit.mediatracker.db.dbQuery
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.time.Clock
import kotlin.time.Instant

data class StoredSession(val id: String, val userId: Long, val username: String, val expiresAt: Instant)

class SessionRepository {
    /** Creates or replaces the session row; Ktor may store the same id more than once per call. */
    suspend fun save(id: String, userId: Long, expiresAt: Instant) = dbQuery {
        val now = Clock.System.now()
        Sessions.deleteWhere { Sessions.id eq id }
        Sessions.insert {
            it[Sessions.id] = id
            it[Sessions.userId] = userId
            it[createdAt] = now
            it[Sessions.expiresAt] = expiresAt
        }
        // Opportunistic cleanup: a login is a fine moment to drop expired rows.
        Sessions.deleteWhere { Sessions.expiresAt less now }
    }

    /** Returns the session joined with its user, or null when unknown. Expiry is checked by the caller. */
    suspend fun find(id: String): StoredSession? = dbQuery {
        Sessions.join(Users, JoinType.INNER, onColumn = Sessions.userId, otherColumn = Users.id)
            .selectAll()
            .where { Sessions.id eq id }
            .singleOrNull()
            ?.let {
                StoredSession(
                    id = it[Sessions.id],
                    userId = it[Sessions.userId],
                    username = it[Users.username],
                    expiresAt = it[Sessions.expiresAt],
                )
            }
    }

    suspend fun delete(id: String): Int = dbQuery {
        Sessions.deleteWhere { Sessions.id eq id }
    }
}
