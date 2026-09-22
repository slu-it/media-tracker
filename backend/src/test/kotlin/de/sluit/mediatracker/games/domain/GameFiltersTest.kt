package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GameFiltersTest {
    @Test
    fun `missing field from round-trips every wire value`() {
        for (field in MissingField.entries) {
            assertEquals(field, MissingField.from(field.wire))
        }
    }

    @Test
    fun `missing field from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { MissingField.from("bogus") }
        assertEquals(MissingField.FIELD, exception.field)
    }

    @Test
    fun `missing field from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { MissingField.from("") }
        assertEquals(MissingField.FIELD, exception.field)
    }

    @Test
    fun `filters are not empty when only missing is set`() {
        assertFalse(GameFilters(missing = setOf(MissingField.DESCRIPTION)).isEmpty)
    }

    @Test
    fun `NONE is empty`() {
        assertTrue(GameFilters.NONE.isEmpty)
    }
}
