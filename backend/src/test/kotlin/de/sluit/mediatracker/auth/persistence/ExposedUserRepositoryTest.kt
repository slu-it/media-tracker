package de.sluit.mediatracker.auth.persistence

import de.sluit.mediatracker.auth.domain.ApiKey
import de.sluit.mediatracker.auth.domain.ApiKeySlot
import de.sluit.mediatracker.auth.insertUser
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

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

    @Test
    fun `saveApiKey then findApiKeys returns the key in the primary slot`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }
        val key = ApiKey.generate()

        val saved = repo.saveApiKey(id, ApiKeySlot.PRIMARY, key)

        assertTrue(saved)
        assertEquals(key, repo.findApiKeys(id)?.primary)
        assertNull(repo.findApiKeys(id)?.secondary)
    }

    @Test
    fun `saveApiKey then findApiKeys returns the key in the secondary slot`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }
        val key = ApiKey.generate()

        val saved = repo.saveApiKey(id, ApiKeySlot.SECONDARY, key)

        assertTrue(saved)
        assertEquals(key, repo.findApiKeys(id)?.secondary)
        assertNull(repo.findApiKeys(id)?.primary)
    }

    @Test
    fun `saveApiKey for an unknown user returns false`() = withFreshDatabase {
        val repo = ExposedUserRepository()

        val saved = repo.saveApiKey(9999L, ApiKeySlot.PRIMARY, ApiKey.generate())

        assertFalse(saved)
    }

    @Test
    fun `findApiKeys for an unknown user returns null`() = withFreshDatabase {
        val repo = ExposedUserRepository()

        assertNull(repo.findApiKeys(9999L))
    }

    @Test
    fun `findByApiKey matches the primary key`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }
        val key = ApiKey.generate()
        repo.saveApiKey(id, ApiKeySlot.PRIMARY, key)

        val found = repo.findByApiKey(key)

        assertEquals(id, found?.id)
    }

    @Test
    fun `findByApiKey matches the secondary key`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }
        val key = ApiKey.generate()
        repo.saveApiKey(id, ApiKeySlot.SECONDARY, key)

        val found = repo.findByApiKey(key)

        assertEquals(id, found?.id)
    }

    @Test
    fun `findByApiKey of an unknown key returns null`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val id = transaction { insertUser("alice", "hash-1") }
        repo.saveApiKey(id, ApiKeySlot.PRIMARY, ApiKey.generate())

        assertNull(repo.findByApiKey(ApiKey.generate()))
    }

    @Test
    fun `saveApiKey rejects the same key on two users`() = withFreshDatabase {
        val repo = ExposedUserRepository()
        val firstId = transaction { insertUser("alice", "hash-1") }
        val secondId = transaction { insertUser("bob", "hash-2") }
        val key = ApiKey.generate()
        repo.saveApiKey(firstId, ApiKeySlot.PRIMARY, key)

        assertFailsWith<ExposedSQLException> { repo.saveApiKey(secondId, ApiKeySlot.PRIMARY, key) }
    }
}
