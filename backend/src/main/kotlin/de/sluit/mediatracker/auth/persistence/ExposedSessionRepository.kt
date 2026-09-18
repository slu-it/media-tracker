package de.sluit.mediatracker.auth.persistence

import de.sluit.mediatracker.auth.domain.SessionRepository
import de.sluit.mediatracker.auth.domain.StoredSession
import de.sluit.mediatracker.common.persistence.dbQuery
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.time.Clock
import kotlin.time.Instant

class ExposedSessionRepository : SessionRepository {
    override suspend fun save(id: String, userId: Long, expiresAt: Instant) {
        dbQuery {
            val now = Clock.System.now()
            SessionsTable.deleteWhere { SessionsTable.id eq id }
            SessionsTable.insert {
                it[SessionsTable.id] = id
                it[SessionsTable.userId] = userId
                it[createdAt] = now
                it[SessionsTable.expiresAt] = expiresAt
            }
            // Opportunistic cleanup: a login is a fine moment to drop expired rows.
            SessionsTable.deleteWhere { SessionsTable.expiresAt less now }
        }
    }

    override suspend fun find(id: String): StoredSession? = dbQuery {
        SessionsTable.join(UsersTable, JoinType.INNER, onColumn = SessionsTable.userId, otherColumn = UsersTable.id)
            .selectAll()
            .where { SessionsTable.id eq id }
            .singleOrNull()
            ?.let {
                StoredSession(
                    id = it[SessionsTable.id],
                    userId = it[SessionsTable.userId],
                    username = it[UsersTable.username],
                    expiresAt = it[SessionsTable.expiresAt],
                )
            }
    }

    override suspend fun delete(id: String): Int = dbQuery {
        SessionsTable.deleteWhere { SessionsTable.id eq id }
    }
}
