package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class GameSortTest {
    @Test
    fun `from round-trips every wire value`() {
        for (sort in GameSort.entries) {
            assertEquals(sort, GameSort.from(sort.wire))
        }
    }

    @Test
    fun `from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { GameSort.from("bogus") }
        assertEquals(GameSort.FIELD, exception.field)
    }

    @Test
    fun `from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { GameSort.from("") }
        assertEquals(GameSort.FIELD, exception.field)
    }

    @Test
    fun `default is title`() {
        assertEquals(GameSort.TITLE, GameSort.DEFAULT)
    }
}
