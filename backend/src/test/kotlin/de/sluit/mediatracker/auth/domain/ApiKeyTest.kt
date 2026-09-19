package de.sluit.mediatracker.auth.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull

class ApiKeyTest {
    @Test
    fun `generate yields the 36-character hex-dash form`() {
        val key = ApiKey.generate()

        assertEquals(36, key.toString().length)
    }

    @Test
    fun `two generated keys differ`() {
        val first = ApiKey.generate()
        val second = ApiKey.generate()

        assertNotEquals(first, second)
    }

    @Test
    fun `parseOrNull round-trips a generated key`() {
        val key = ApiKey.generate()

        assertEquals(key, ApiKey.parseOrNull(key.toString()))
    }

    @Test
    fun `parseOrNull returns null for garbage text`() {
        assertNull(ApiKey.parseOrNull("not-a-uuid"))
        assertNull(ApiKey.parseOrNull(""))
    }
}
