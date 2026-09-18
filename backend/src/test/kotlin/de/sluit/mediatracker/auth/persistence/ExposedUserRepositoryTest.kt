package de.sluit.mediatracker.auth.persistence

import de.sluit.mediatracker.auth.insertUser
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class ExposedUserRepositoryTest {

    @Test
    fun `createBlocking then findByUsername returns the user`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }

        val found = repo.findByUsername("alice")

        assertEquals(id, found?.id)
        assertEquals("alice", found?.username)
        assertEquals("hash-1", found?.passwordHash)
    }

    @Test
    fun `findByUsername of an unknown user returns null`() = withFreshDatabase {
        val repo = ExposedUserRepository()

        assertNull(repo.findByUsername("nobody"))
    }

    @Test
    fun `updatePasswordBlocking replaces the hash and returns 1`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }

        val updated = transaction { repo.updatePasswordBlocking(id, "hash-2") }

        assertEquals(1, updated)
        assertEquals("hash-2", repo.findByUsername("alice")?.passwordHash)
    }

    @Test
    fun `updatePasswordBlocking of an unknown id returns 0`() = withFreshDatabase {
        val repo = ExposedUserRepository()

        val updated = transaction { repo.updatePasswordBlocking(9999L, "hash") }

        assertEquals(0, updated)
    }

    @Test
    fun `createBlocking rejects a duplicate username`() = withFreshDatabase {
        transaction { insertUser("alice", "hash-1") }

        transaction {
            assertFailsWith<ExposedSQLException> { insertUser("alice", "hash-2") }
        }
    }
}
