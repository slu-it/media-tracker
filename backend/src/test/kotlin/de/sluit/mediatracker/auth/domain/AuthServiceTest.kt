package de.sluit.mediatracker.auth.domain

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import io.mockk.spyk
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Mocks only [UserRepository]; the password hasher is real (with cheap parameters), so these tests exercise
 * actual verification, trimming and password zeroing.
 */
class AuthServiceTest {
    // Small parameters keep the test fast; the format is identical to production.
    private val hasher = PasswordHasher(memoryKb = 1024, iterations = 1)
    private val users = mockk<UserRepository>()
    private val service = AuthService(users, hasher)

    @Test
    fun `login returns the user when the password verifies`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user

        val result = service.login("alice", "correct horse".toCharArray())

        assertEquals(user, result)
    }

    @Test
    fun `login returns null for a wrong password`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user

        val result = service.login("alice", "wrong password".toCharArray())

        assertNull(result)
    }

    @Test
    fun `login returns null for an unknown user`() = runBlocking {
        coEvery { users.findByUsername("ghost") } returns null

        val result = service.login("ghost", "whatever".toCharArray())

        assertNull(result)
    }

    @Test
    fun `login trims the username before the lookup`() = runBlocking {
        coEvery { users.findByUsername("alice") } returns null

        service.login("  alice  ", "whatever".toCharArray())

        coVerify { users.findByUsername("alice") }
    }

    @Test
    fun `login zeroes the password array after use`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user

        val successPassword = "correct horse".toCharArray()
        service.login("alice", successPassword)
        assertTrue(successPassword.all { it == '\u0000' })

        val failurePassword = "wrong password".toCharArray()
        service.login("alice", failurePassword)
        assertTrue(failurePassword.all { it == '\u0000' })
    }

    @Test
    fun `login verifies against a dummy hash when the user is unknown`() = runBlocking {
        val spyHasher = spyk(PasswordHasher(memoryKb = 1024, iterations = 1))
        val spyService = AuthService(users, spyHasher)
        coEvery { users.findByUsername("ghost") } returns null
        val usedHash = slot<String>()

        spyService.login("ghost", "whatever".toCharArray())

        verify(exactly = 1) { spyHasher.verify(any<CharArray>(), capture(usedHash)) }
        assertTrue(usedHash.captured.isNotEmpty())
    }
}
