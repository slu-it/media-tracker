package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CoverTypeTest {
    @Test
    fun `wire values are the lowercase constant names`() {
        assertEquals("static", CoverType.STATIC.wire)
        assertEquals("animated", CoverType.ANIMATED.wire)
    }

    @Test
    fun `from round-trips every wire value`() {
        for (type in CoverType.entries) {
            assertEquals(type, CoverType.from(type.wire))
        }
    }

    @Test
    fun `from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { CoverType.from("gif") }
        assertEquals(CoverType.FIELD, exception.field)
    }

    @Test
    fun `default is static`() {
        assertEquals(CoverType.STATIC, CoverType.DEFAULT)
    }
}
