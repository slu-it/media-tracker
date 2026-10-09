package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class BookSortTest {
    @Test
    fun `from round-trips every wire value`() {
        for (sort in BookSort.entries) {
            assertEquals(sort, BookSort.from(sort.wire))
        }
    }

    @Test
    fun `wire values are title release_asc and release_desc`() {
        assertEquals(listOf("title", "release_asc", "release_desc"), BookSort.entries.map { it.wire })
    }

    @Test
    fun `from an unknown value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { BookSort.from("bogus") }
        assertEquals(BookSort.FIELD, exception.field)
    }

    @Test
    fun `from an empty value throws InvalidValueException`() {
        val exception = assertFailsWith<InvalidValueException> { BookSort.from("") }
        assertEquals(BookSort.FIELD, exception.field)
    }

    @Test
    fun `default is title`() {
        assertEquals(BookSort.TITLE, BookSort.DEFAULT)
    }
}
