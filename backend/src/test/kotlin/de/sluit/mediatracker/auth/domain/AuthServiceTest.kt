package de.sluit.mediatracker.auth.domain

import de.sluit.mediatracker.common.domain.WrongPasswordException
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.coVerifyOrder
import io.mockk.mockk
import io.mockk.slot
import io.mockk.spyk
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
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
    private val sessions = mockk<SessionRepository>()
    private val service = AuthService(users, hasher, sessions)

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
        val spyService = AuthService(users, spyHasher, sessions)
        coEvery { users.findByUsername("ghost") } returns null
        val usedHash = slot<String>()

        spyService.login("ghost", "whatever".toCharArray())

        verify(exactly = 1) { spyHasher.verify(any<CharArray>(), capture(usedHash)) }
        assertTrue(usedHash.captured.isNotEmpty())
    }

    @Test
    fun `changePassword throws wrong password for a wrong current password and stores nothing`() {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user

        assertFailsWith<WrongPasswordException> {
            runBlocking {
                service.changePassword(
                    "alice",
                    1,
                    "session-1",
                    "wrong password".toCharArray(),
                    NewPassword("new password"),
                )
            }
        }
        coVerify(exactly = 0) { users.updatePassword(any(), any()) }
        coVerify(exactly = 0) { sessions.deleteAllForUserExcept(any(), any()) }
    }

    @Test
    fun `changePassword throws wrong password for an unknown user`() {
        coEvery { users.findByUsername("ghost") } returns null

        assertFailsWith<WrongPasswordException> {
            runBlocking {
                service.changePassword(
                    "ghost",
                    1,
                    "session-1",
                    "whatever".toCharArray(),
                    NewPassword("new password"),
                )
            }
        }
        coVerify(exactly = 0) { users.updatePassword(any(), any()) }
        coVerify(exactly = 0) { sessions.deleteAllForUserExcept(any(), any()) }
    }

    @Test
    fun `changePassword throws wrong password when the session userId does not match the looked-up user`() {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user

        assertFailsWith<WrongPasswordException> {
            runBlocking {
                service.changePassword(
                    "alice",
                    42,
                    "session-1",
                    "correct horse".toCharArray(),
                    NewPassword("new password"),
                )
            }
        }
        coVerify(exactly = 0) { users.updatePassword(any(), any()) }
        coVerify(exactly = 0) { sessions.deleteAllForUserExcept(any(), any()) }
    }

    @Test
    fun `changePassword throws wrong password for an implausibly long current password without hashing it`() {
        val spyHasher = spyk(PasswordHasher(memoryKb = 1024, iterations = 1))
        val spyService = AuthService(users, spyHasher, sessions)
        val current = "x".repeat(NewPassword.MAX_LENGTH + 1).toCharArray()

        assertFailsWith<WrongPasswordException> {
            runBlocking {
                spyService.changePassword("alice", 1, "session-1", current, NewPassword("new password"))
            }
        }
        verify(exactly = 0) { spyHasher.verify(any<CharArray>(), any<String>()) }
        coVerify(exactly = 0) { users.findByUsername(any()) }
        coVerify(exactly = 0) { users.updatePassword(any(), any()) }
        coVerify(exactly = 0) { sessions.deleteAllForUserExcept(any(), any()) }
    }

    @Test
    fun `changePassword throws wrong password when updatePassword finds the user row gone`() {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user
        coEvery { sessions.deleteAllForUserExcept(1, "session-keep") } returns 0
        coEvery { users.updatePassword(1, any()) } returns false

        assertFailsWith<WrongPasswordException> {
            runBlocking {
                service.changePassword(
                    "alice",
                    1,
                    "session-keep",
                    "correct horse".toCharArray(),
                    NewPassword("new password"),
                )
            }
        }
    }

    @Test
    fun `changePassword zeroes the current password array after a failure`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user
        val current = "wrong password".toCharArray()

        assertFailsWith<WrongPasswordException> {
            service.changePassword("alice", 1, "session-1", current, NewPassword("new password"))
        }

        assertTrue(current.all { it == '\u0000' })
    }

    @Test
    fun `changePassword hashes and stores the new password, then signs out every other session`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user
        val storedHash = slot<String>()
        coEvery { users.updatePassword(1, capture(storedHash)) } returns true
        coEvery { sessions.deleteAllForUserExcept(1, "session-keep") } returns 3

        service.changePassword(
            "alice",
            1,
            "session-keep",
            "correct horse".toCharArray(),
            NewPassword("new password"),
        )

        assertTrue(hasher.verify("new password".toCharArray(), storedHash.captured))
        coVerify(exactly = 1) { sessions.deleteAllForUserExcept(1, "session-keep") }
    }

    @Test
    fun `changePassword deletes the other sessions before updating the password`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user
        coEvery { sessions.deleteAllForUserExcept(1, "session-keep") } returns 0
        coEvery { users.updatePassword(1, any()) } returns true

        service.changePassword(
            "alice",
            1,
            "session-keep",
            "correct horse".toCharArray(),
            NewPassword("new password"),
        )

        coVerifyOrder {
            sessions.deleteAllForUserExcept(1, "session-keep")
            users.updatePassword(1, any())
        }
    }

    @Test
    fun `changePassword zeroes the current password array after success`() = runBlocking {
        val user = User(id = 1, username = "alice", passwordHash = hasher.hash("correct horse"))
        coEvery { users.findByUsername("alice") } returns user
        coEvery { users.updatePassword(1, any()) } returns true
        coEvery { sessions.deleteAllForUserExcept(1, "session-keep") } returns 0
        val current = "correct horse".toCharArray()

        service.changePassword("alice", 1, "session-keep", current, NewPassword("new password"))

        assertTrue(current.all { it == '\u0000' })
    }
}
