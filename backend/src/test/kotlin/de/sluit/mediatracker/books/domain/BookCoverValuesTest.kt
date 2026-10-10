package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class BookCoverValuesTest {
    @Test
    fun `a work id parses`() {
        assertEquals("OL45804W", BookWorkId.parse("OL45804W").value)
    }

    @Test
    fun `a malformed work id is rejected with the match field`() {
        for (raw in listOf("", "45804", "OL45804M", "ol45804w", "OLW", "OL1W ", "OL1WX")) {
            val e = assertFailsWith<InvalidValueException> { BookWorkId.parse(raw) }
            assertEquals(BookWorkId.FIELD, e.field)
        }
    }

    @Test
    fun `a source kind parses its wire value`() {
        assertEquals(BookCoverSourceKind.BOOK, BookCoverSourceKind.from("book"))
        assertEquals(BookCoverSourceKind.AUDIOBOOK, BookCoverSourceKind.from("audiobook"))
    }

    @Test
    fun `the wire value is the lowercase name`() {
        assertEquals("audiobook", BookCoverSourceKind.AUDIOBOOK.wire)
    }

    @Test
    fun `an unknown source kind is rejected with the source field`() {
        val e = assertFailsWith<InvalidValueException> { BookCoverSourceKind.from("ebook") }
        assertEquals(BookCoverSourceKind.FIELD, e.field)
    }
}
