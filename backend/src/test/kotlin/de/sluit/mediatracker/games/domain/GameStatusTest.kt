package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class GameStatusTest {
    @Test
    fun `ownership wire values are the lowercase constant names`() {
        assertEquals("watchlist", Ownership.WATCHLIST.wire)
        assertEquals("owned", Ownership.OWNED.wire)
    }

    @Test
    fun `ownership from round-trips every wire value`() {
        for (ownership in Ownership.entries) {
            assertEquals(ownership, Ownership.from(ownership.wire))
        }
    }

    @Test
    fun `ownership from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { Ownership.from("bogus") }
        assertEquals(Ownership.FIELD, exception.field)
    }

    @Test
    fun `ownership from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { Ownership.from("") }
        assertEquals(Ownership.FIELD, exception.field)
    }

    @Test
    fun `ownership default is watchlist`() {
        assertEquals(Ownership.WATCHLIST, Ownership.DEFAULT)
    }

    @Test
    fun `progress wire values are the lowercase constant names`() {
        assertEquals("not_started", Progress.NOT_STARTED.wire)
        assertEquals("playing", Progress.PLAYING.wire)
        assertEquals("finished", Progress.FINISHED.wire)
        assertEquals("completed", Progress.COMPLETED.wire)
        assertEquals("paused", Progress.PAUSED.wire)
        assertEquals("abandoned", Progress.ABANDONED.wire)
    }

    @Test
    fun `progress from round-trips every wire value`() {
        for (progress in Progress.entries) {
            assertEquals(progress, Progress.from(progress.wire))
        }
    }

    @Test
    fun `progress from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { Progress.from("bogus") }
        assertEquals(Progress.FIELD, exception.field)
    }

    @Test
    fun `progress from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { Progress.from("") }
        assertEquals(Progress.FIELD, exception.field)
    }

    @Test
    fun `progress default is not started`() {
        assertEquals(Progress.NOT_STARTED, Progress.DEFAULT)
    }

    @Test
    fun `hidden default is false`() {
        assertEquals(false, DEFAULT_HIDDEN)
    }
}
