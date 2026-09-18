package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.insertUser
import de.sluit.mediatracker.auth.persistence.ExposedSessionRepository
import de.sluit.mediatracker.auth.persistence.SessionsTable
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes

class DbSessionStorageTest {

    @Test
    fun `write then read returns the serialized user session`() = withFreshDatabase {
        val repository = ExposedSessionRepository()
        val storage = DbSessionStorage(repository, maxAge = 1.hours)
        val userId = transaction { insertUser("alice") }
        val before = Clock.System.now()

        storage.write("session-1", Json.encodeToString(UserSession(userId, "alice")))

        assertEquals("""{"userId":$userId,"username":"alice"}""", storage.read("session-1"))
        val stored = repository.find("session-1")
        assertTrue(stored != null)
        assertTrue(stored!!.expiresAt >= before + 59.minutes)
        assertTrue(stored.expiresAt <= before + 61.minutes)
    }

    @Test
    fun `read rebuilds the session from the user row not from the written value`() = withFreshDatabase {
        val repository = ExposedSessionRepository()
        val storage = DbSessionStorage(repository, maxAge = 1.hours)
        val userId = transaction { insertUser("alice") }

        storage.write("session-1", Json.encodeToString(UserSession(userId, "someone-else")))

        assertEquals("""{"userId":$userId,"username":"alice"}""", storage.read("session-1"))
    }

    @Test
    fun `read of an unknown id throws NoSuchElementException`() = withFreshDatabase {
        val storage = DbSessionStorage(ExposedSessionRepository(), maxAge = 1.hours)

        assertFailsWith<NoSuchElementException> {
            storage.read("unknown")
        }
    }

    @Test
    fun `read of an expired session throws and deletes the row`() = withFreshDatabase {
        val repository = ExposedSessionRepository()
        val storage = DbSessionStorage(repository, maxAge = 1.hours)
        val userId = transaction { insertUser("alice") }
        val now = Clock.System.now()
        transaction {
            SessionsTable.insert {
                it[id] = "expired"
                it[SessionsTable.userId] = userId
                it[createdAt] = now - 2.hours
                it[expiresAt] = now - 1.minutes
            }
        }

        assertFailsWith<NoSuchElementException> {
            storage.read("expired")
        }

        assertNull(repository.find("expired"))
    }

    @Test
    fun `invalidate deletes the session`() = withFreshDatabase {
        val repository = ExposedSessionRepository()
        val storage = DbSessionStorage(repository, maxAge = 1.hours)
        val userId = transaction { insertUser("alice") }
        storage.write("session-1", Json.encodeToString(UserSession(userId, "alice")))

        storage.invalidate("session-1")

        assertNull(repository.find("session-1"))
    }

    @Test
    fun `write rejects a value that is not a user session and stores nothing`() = withFreshDatabase {
        val repository = ExposedSessionRepository()
        val storage = DbSessionStorage(repository, maxAge = 1.hours)
        transaction { insertUser("alice") }

        assertFailsWith<SerializationException> {
            storage.write("session-1", """{"nope":1}""")
        }
        assertNull(repository.find("session-1"))

        assertFailsWith<SerializationException> {
            storage.write("session-1", "not json")
        }
        assertNull(repository.find("session-1"))
    }
}
