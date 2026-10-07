package de.sluit.mediatracker.auth.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class NewPasswordTest {
    @Test
    fun `rejects a password shorter than 8 characters`() {
        val exception = assertFailsWith<InvalidValueException> { NewPassword("1234567") }

        assertEquals("newPassword", exception.field)
    }

    @Test
    fun `accepts a password of exactly 8 characters`() {
        val newPassword = NewPassword("12345678")

        assertContentEquals("12345678".toCharArray(), newPassword.toCharArray())
    }

    @Test
    fun `accepts a password of exactly 1024 characters`() {
        val value = "a".repeat(1024)

        val newPassword = NewPassword(value)

        assertContentEquals(value.toCharArray(), newPassword.toCharArray())
    }

    @Test
    fun `rejects a password longer than 1024 characters`() {
        val exception = assertFailsWith<InvalidValueException> { NewPassword("a".repeat(1025)) }

        assertEquals("newPassword", exception.field)
    }

    @Test
    fun `toString never reveals the password`() {
        val newPassword = NewPassword("super secret")

        assertEquals("NewPassword(redacted)", newPassword.toString())
    }

    @Test
    fun `equals compares content, like any other string-backed value class`() {
        val first = NewPassword("super secret")
        val second = NewPassword("super secret")

        assertEquals(first, second)
    }
}
