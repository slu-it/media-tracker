package de.sluit.mediatracker.auth.domain

import de.sluit.mediatracker.common.domain.NotFoundException
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

/**
 * Mocks only [UserRepository]; everything else is real, so these tests exercise the actual key generation and
 * parsing logic.
 */
class ApiKeyServiceTest {
    private val users = mockk<UserRepository>()
    private val service = ApiKeyService(users)

    @Test
    fun `regenerate saves a new key into the requested slot and returns the re-read keys`() = runBlocking {
        val savedKey = slot<ApiKey>()
        coEvery { users.saveApiKey(1L, ApiKeySlot.SECONDARY, capture(savedKey)) } returns true
        val reread = ApiKeys(primary = null, secondary = ApiKey.generate())
        coEvery { users.findApiKeys(1L) } returns reread

        val result = service.regenerate(1L, ApiKeySlot.SECONDARY)

        coVerify { users.saveApiKey(1L, ApiKeySlot.SECONDARY, savedKey.captured) }
        assertEquals(reread, result)
    }

    @Test
    fun `regenerate for an unknown user throws NotFoundException`() = runBlocking {
        coEvery { users.saveApiKey(any(), any(), any()) } returns false

        assertFailsWith<NotFoundException> { service.regenerate(404L, ApiKeySlot.PRIMARY) }

        coVerify(exactly = 0) { users.findApiKeys(any()) }
    }

    @Test
    fun `authenticate with non-UUID text returns null without querying the repository`() = runBlocking {
        val result = service.authenticate("not-a-uuid")

        assertNull(result)
        coVerify(exactly = 0) { users.findByApiKey(any()) }
    }

    @Test
    fun `authenticate with an unknown key returns null`() = runBlocking {
        val key = ApiKey.generate()
        coEvery { users.findByApiKey(key) } returns null

        val result = service.authenticate(key.toString())

        assertNull(result)
    }

    @Test
    fun `authenticate with a known key returns the user`() = runBlocking {
        val key = ApiKey.generate()
        val user = User(id = 1, username = "alice", passwordHash = "hash")
        coEvery { users.findByApiKey(key) } returns user

        val result = service.authenticate(key.toString())

        assertEquals(user, result)
    }

    @Test
    fun `keysFor an unknown user throws NotFoundException`() = runBlocking {
        coEvery { users.findApiKeys(404L) } returns null

        assertFailsWith<NotFoundException> { service.keysFor(404L) }

        coVerify { users.findApiKeys(404L) }
    }
}
