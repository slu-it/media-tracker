package de.sluit.mediatracker.auth.persistence

import de.sluit.mediatracker.auth.insertUser
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Clock
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.minutes

class ExposedSessionRepositoryTest {

    @Test
    fun `save then find returns the session joined with its user`() = withFreshDatabase {
        val repo = ExposedSessionRepository()
        val userId = transaction { insertUser("alice") }
        val expiresAt = Clock.System.now() + 1.days

        repo.save("session-1", userId, expiresAt)
        val found = repo.find("session-1")

        assertEquals("session-1", found?.id)
        assertEquals(userId, found?.userId)
        assertEquals("alice", found?.username)
        assertEquals(expiresAt, found?.expiresAt)
    }

    @Test
    fun `find of an unknown id returns null`() = withFreshDatabase {
        val repo = ExposedSessionRepository()

        assertNull(repo.find("unknown"))
    }

    @Test
    fun `save replaces an existing row with the same id`() = withFreshDatabase {
        val repo = ExposedSessionRepository()
        val userId = transaction { insertUser("alice") }
        val firstExpiry = Clock.System.now() + 1.days
        val secondExpiry = Clock.System.now() + 2.days

        repo.save("session-1", userId, firstExpiry)
        repo.save("session-1", userId, secondExpiry)

        val rowCount = transaction { SessionsTable.selectAll().where { SessionsTable.id eq "session-1" }.count() }
        assertEquals(1, rowCount)
        assertEquals(secondExpiry, repo.find("session-1")?.expiresAt)
    }

    @Test
    fun `save removes expired rows of other sessions`() = withFreshDatabase {
        val repo = ExposedSessionRepository()
        val userId = transaction { insertUser("alice") }
        val now = Clock.System.now()
        transaction {
            SessionsTable.insert {
                it[id] = "expired"
                it[SessionsTable.userId] = userId
                it[createdAt] = now - 2.days
                it[expiresAt] = now - 1.minutes
            }
        }

        repo.save("session-1", userId, now + 1.days)

        assertNull(repo.find("expired"))
    }

    @Test
    fun `save keeps unexpired rows of other sessions`() = withFreshDatabase {
        val repo = ExposedSessionRepository()
        val userId = transaction { insertUser("alice") }
        val now = Clock.System.now()
        repo.save("session-other", userId, now + 1.days)

        repo.save("session-1", userId, now + 1.days)

        assertEquals("session-other", repo.find("session-other")?.id)
    }

    @Test
    fun `delete returns 1 for an existing session and 0 afterwards`() = withFreshDatabase {
        val repo = ExposedSessionRepository()
        val userId = transaction { insertUser("alice") }
        repo.save("session-1", userId, Clock.System.now() + 1.days)

        assertEquals(1, repo.delete("session-1"))
        assertEquals(0, repo.delete("session-1"))
    }

    @Test
    fun `deleting the user cascades to its sessions`() = withFreshDatabase {
        val repo = ExposedSessionRepository()
        val userId = transaction { insertUser("alice") }
        repo.save("session-1", userId, Clock.System.now() + 1.days)

        transaction { UsersTable.deleteWhere { UsersTable.id eq userId } }

        assertNull(repo.find("session-1"))
    }
}
