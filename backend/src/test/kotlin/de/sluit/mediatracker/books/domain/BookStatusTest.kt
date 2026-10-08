package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class BookStatusTest {
    @Test
    fun `ownership wire values are the lowercase constant names`() {
        assertEquals("watchlist", BookOwnership.WATCHLIST.wire)
        assertEquals("owned", BookOwnership.OWNED.wire)
    }

    @Test
    fun `ownership declaration order is the display order`() {
        assertEquals(listOf(BookOwnership.WATCHLIST, BookOwnership.OWNED), BookOwnership.entries)
    }

    @Test
    fun `ownership from round-trips every wire value`() {
        for (ownership in BookOwnership.entries) {
            assertEquals(ownership, BookOwnership.from(ownership.wire))
        }
    }

    @Test
    fun `ownership from rejects subscription`() {
        val exception = assertFailsWith<InvalidValueException> { BookOwnership.from("subscription") }
        assertEquals(BookOwnership.FIELD, exception.field)
    }

    @Test
    fun `ownership from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { BookOwnership.from("") }
        assertEquals(BookOwnership.FIELD, exception.field)
    }

    @Test
    fun `ownership default is watchlist`() {
        assertEquals(BookOwnership.WATCHLIST, BookOwnership.DEFAULT)
    }

    @Test
    fun `progress wire values are the lowercase constant names`() {
        assertEquals("abandoned", BookProgress.ABANDONED.wire)
        assertEquals("not_started", BookProgress.NOT_STARTED.wire)
        assertEquals("paused", BookProgress.PAUSED.wire)
        assertEquals("reading", BookProgress.READING.wire)
        assertEquals("finished", BookProgress.FINISHED.wire)
    }

    @Test
    fun `progress declaration order is the display order`() {
        assertEquals(
            listOf(
                BookProgress.ABANDONED,
                BookProgress.NOT_STARTED,
                BookProgress.PAUSED,
                BookProgress.READING,
                BookProgress.FINISHED,
            ),
            BookProgress.entries,
        )
    }

    @Test
    fun `progress from round-trips every wire value`() {
        for (progress in BookProgress.entries) {
            assertEquals(progress, BookProgress.from(progress.wire))
        }
    }

    @Test
    fun `progress from rejects playing`() {
        val exception = assertFailsWith<InvalidValueException> { BookProgress.from("playing") }
        assertEquals(BookProgress.FIELD, exception.field)
    }

    @Test
    fun `progress from rejects completed`() {
        val exception = assertFailsWith<InvalidValueException> { BookProgress.from("completed") }
        assertEquals(BookProgress.FIELD, exception.field)
    }

    @Test
    fun `progress from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { BookProgress.from("") }
        assertEquals(BookProgress.FIELD, exception.field)
    }

    @Test
    fun `progress default is not started`() {
        assertEquals(BookProgress.NOT_STARTED, BookProgress.DEFAULT)
    }
}
