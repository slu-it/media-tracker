package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.author
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.narrator
import de.sluit.mediatracker.books.series
import de.sluit.mediatracker.books.seriesEntry
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import java.math.BigDecimal
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

class BookValuesTest {
    private fun rejects(field: String, block: () -> Any?) {
        val e = assertFailsWith<InvalidValueException> { block() }
        assertEquals(field, e.field)
    }

    @Test
    fun `book id parses only the 36-character hex-dash form and round-trips`() {
        val id = BookId.new()
        assertEquals(36, id.toString().length)
        assertEquals(id, BookId.parse(id.toString()))
        rejects("id") { BookId.parse("nope") }
        rejects("id") { BookId.parse(id.toString().replace("-", "")) }
    }

    @Test
    fun `book type id parses only the 36-character hex-dash form`() {
        val id = BookTypeId(Uuid.random())
        assertEquals(id, BookTypeId.parse(id.toString()))
        rejects("typeIds") { BookTypeId.parse("nope") }
        rejects("typeIds") { BookTypeId.parse(id.toString().replace("-", "")) }
    }

    @Test
    fun `book author id parses only the 36-character hex-dash form`() {
        val id = BookAuthorId.new()
        assertEquals(id, BookAuthorId.parse(id.toString()))
        rejects("authorIds") { BookAuthorId.parse("nope") }
    }

    @Test
    fun `book narrator and series ids parse only the 36-character hex-dash form`() {
        val narratorId = BookNarratorId.new()
        assertEquals(narratorId, BookNarratorId.parse(narratorId.toString()))
        rejects("narratorIds") { BookNarratorId.parse("nope") }
        val seriesId = BookSeriesId.new()
        assertEquals(seriesId, BookSeriesId.parse(seriesId.toString()))
        rejects("series") { BookSeriesId.parse("nope") }
    }

    @Test
    fun `a book rejects duplicate or unsorted narrators`() {
        val zed = narrator("Zed")
        val able = narrator("Able")
        rejects("narratorIds") {
            Book(BookId.new(), Title("Dune"), ReleaseYear(1965), narrators = listOf(zed, zed))
        }
        rejects("narratorIds") {
            Book(BookId.new(), Title("Dune"), ReleaseYear(1965), narrators = listOf(zed, able))
        }
    }

    @Test
    fun `a book rejects duplicate or unsorted series`() {
        val zed = series("Zed")
        val able = series("Able")
        rejects("series") {
            Book(
                BookId.new(),
                Title("Dune"),
                ReleaseYear(1965),
                series = listOf(seriesEntry(zed), seriesEntry(zed, 2.0)),
            )
        }
        rejects("series") {
            Book(BookId.new(), Title("Dune"), ReleaseYear(1965), series = listOf(seriesEntry(zed), seriesEntry(able)))
        }
    }

    @Test
    fun `a series position accepts the boundaries and normalises trailing zeros`() {
        assertEquals(BigDecimal.ZERO, BookSeriesPosition.fromDouble(0.0).value)
        assertEquals(BigDecimal("9999.99"), BookSeriesPosition.fromDouble(9999.99).value)
        assertEquals(BigDecimal("2.5"), BookSeriesPosition.fromDouble(2.5).value)
        assertEquals(BookSeriesPosition.fromDouble(2.5), BookSeriesPosition.of(BigDecimal("2.50")))
        assertEquals("1", BookSeriesPosition.fromDouble(1.0).toString())
        assertEquals("10", BookSeriesPosition.of(BigDecimal("10.00")).toString())
        assertEquals("0.25", BookSeriesPosition.fromDouble(0.25).toString())
    }

    @Test
    fun `a series position rejects a value that is not normalised`() {
        rejects("series") { BookSeriesPosition(BigDecimal("2.50")) }
        rejects("series") { BookSeriesPosition(BigDecimal("1E+1")) }
        rejects("series") { BookSeriesPosition(BigDecimal("0.00")) }
        assertEquals(BigDecimal("10"), BookSeriesPosition(BigDecimal("10")).value)
        assertEquals(BigDecimal.ZERO, BookSeriesPosition(BigDecimal.ZERO).value)
    }

    @Test
    fun `a series position rejects negative, too large and too precise numbers`() {
        rejects("series") { BookSeriesPosition.fromDouble(-1.0) }
        rejects("series") { BookSeriesPosition.fromDouble(10000.0) }
        rejects("series") { BookSeriesPosition.fromDouble(9999.991) }
        rejects("series") { BookSeriesPosition.fromDouble(1.234) }
        rejects("series") { BookSeriesPosition.fromDouble(Double.NaN) }
        rejects("series") { BookSeriesPosition.fromDouble(Double.POSITIVE_INFINITY) }
    }

    @Test
    fun `patch replaces narrators only when narratorIds is present`() {
        val reader = narrator("A Reader")
        val book = book("Dune", narrators = listOf(reader))

        assertEquals(listOf(reader), BookPatch().applyTo(book, book.types, book.authors).narrators)

        val other = narrator("Other")
        val replaced = BookPatch(narratorIds = setOf(other.id))
            .applyTo(book, book.types, book.authors, listOf(other), book.series)
        assertEquals(listOf(other), replaced.narrators)

        val cleared = BookPatch(narratorIds = emptySet())
            .applyTo(book, book.types, book.authors, emptyList(), book.series)
        assertTrue(cleared.narrators.isEmpty())
    }

    @Test
    fun `patch replaces series only when series is present`() {
        val mistborn = series("Mistborn")
        val book = book("Dune", series = listOf(seriesEntry(mistborn, 1.0)))

        assertEquals(book.series, BookPatch().applyTo(book, book.types, book.authors).series)

        val cosmere = series("The Cosmere")
        val replaced = BookPatch(series = mapOf(cosmere.id to null))
            .applyTo(book, book.types, book.authors, book.narrators, listOf(seriesEntry(cosmere)))
        assertEquals(listOf(seriesEntry(cosmere)), replaced.series)

        val cleared = BookPatch(series = emptyMap())
            .applyTo(book, book.types, book.authors, book.narrators, emptyList())
        assertTrue(cleared.series.isEmpty())
    }

    @Test
    fun `book type label must be non-blank and at most 64 characters`() {
        rejects("label") { BookTypeLabel("") }
        rejects("label") { BookTypeLabel("   ") }
        rejects("label") { BookTypeLabel("x".repeat(65)) }
        assertEquals(64, BookTypeLabel("x".repeat(64)).value.length)
    }

    @Test
    fun `book type label rejects surrounding whitespace and parse trims it`() {
        rejects("label") { BookTypeLabel(" Kindle") }
        rejects("label") { BookTypeLabel("Kindle ") }
        assertEquals("Kindle", BookTypeLabel.parse("  Kindle ").value)
        rejects("label") { BookTypeLabel.parse("   ") }
    }

    @Test
    fun `a book may have no types and no authors`() {
        val book = Book(id = BookId.new(), title = Title("Dune"), releaseYear = ReleaseYear(1965))
        assertEquals(emptyList(), book.types)
        assertEquals(emptyList(), book.authors)
    }

    @Test
    fun `a book rejects duplicate or unsorted types`() {
        rejects("typeIds") {
            Book(
                id = BookId.new(),
                title = Title("Dune"),
                releaseYear = ReleaseYear(1965),
                types = listOf(BookTypes.KINDLE, BookTypes.KINDLE),
            )
        }
        rejects("typeIds") {
            Book(
                id = BookId.new(),
                title = Title("Dune"),
                releaseYear = ReleaseYear(1965),
                types = listOf(BookTypes.PAPERBACK, BookTypes.HARDCOVER),
            )
        }
    }

    @Test
    fun `a book rejects duplicate or unsorted authors`() {
        val herbert = author("Frank Herbert")
        val adams = author("Douglas Adams")
        rejects("authorIds") {
            Book(
                id = BookId.new(),
                title = Title("Dune"),
                releaseYear = ReleaseYear(1965),
                authors = listOf(herbert, herbert),
            )
        }
        rejects("authorIds") {
            Book(
                id = BookId.new(),
                title = Title("Dune"),
                releaseYear = ReleaseYear(1965),
                authors = listOf(herbert, adams),
            )
        }
    }

    @Test
    fun `patch applies only the fields it carries`() {
        val book = book(
            "Old",
            types = listOf(BookTypes.PAPERBACK),
            releaseYear = 1999,
            description = Description("Old description"),
            coverImageUrl = CoverImageUrl("https://example.org/old.png"),
        )

        assertEquals(book, BookPatch().applyTo(book, book.types, book.authors))

        val retitled = BookPatch(title = Title("New")).applyTo(book, book.types, book.authors)
        assertEquals("New", retitled.title.value)
        assertEquals(book.coverImageUrl, retitled.coverImageUrl)

        val cleared = BookPatch(
            description = Patch.Change(null),
            coverImageUrl = Patch.Change(null),
        ).applyTo(book, book.types, book.authors)
        assertNull(cleared.description)
        assertNull(cleared.coverImageUrl)

        val recovered = BookPatch(
            description = Patch.Change(Description("New description")),
            coverImageUrl = Patch.Change(CoverImageUrl("https://example.org/n.png")),
        ).applyTo(book, book.types, book.authors)
        assertEquals("New description", recovered.description?.value)
        assertEquals("https://example.org/n.png", recovered.coverImageUrl?.value)
    }

    @Test
    fun `patch replaces types only when typeIds is present and empty typeIds clears them`() {
        val book = book("Dune", types = listOf(BookTypes.PAPERBACK))

        val unchanged = BookPatch().applyTo(book, book.types, book.authors)
        assertEquals(listOf(BookTypes.PAPERBACK), unchanged.types)

        val replaced = BookPatch(typeIds = setOf(BookTypes.KINDLE.id))
            .applyTo(book, listOf(BookTypes.KINDLE), book.authors)
        assertEquals(listOf(BookTypes.KINDLE), replaced.types)

        val cleared = BookPatch(typeIds = emptySet()).applyTo(book, emptyList(), book.authors)
        assertEquals(emptyList(), cleared.types)
    }

    @Test
    fun `patch replaces authors only when authorIds is present`() {
        val herbert = author("Frank Herbert")
        val book = book("Dune", authors = listOf(herbert))

        val unchanged = BookPatch().applyTo(book, book.types, book.authors)
        assertEquals(listOf(herbert), unchanged.authors)

        val adams = author("Douglas Adams")
        val replaced = BookPatch(authorIds = setOf(adams.id)).applyTo(book, book.types, listOf(adams))
        assertEquals(listOf(adams), replaced.authors)

        val cleared = BookPatch(authorIds = emptySet()).applyTo(book, book.types, emptyList())
        assertEquals(emptyList(), cleared.authors)
    }

    @Test
    fun `patch changes ownership and progress when it carries them`() {
        val book = book("Dune")

        val patched = BookPatch(ownership = BookOwnership.OWNED, progress = BookProgress.READING)
            .applyTo(book, book.types, book.authors)

        assertEquals(BookOwnership.OWNED, patched.ownership)
        assertEquals(BookProgress.READING, patched.progress)
    }

    // release date <-> release year precedence (ADR 0029)

    @Test
    fun `a book with a release date requires releaseYear to match its year`() {
        rejects("releaseDate") {
            Book(
                id = BookId.new(),
                title = Title("Dune"),
                releaseYear = ReleaseYear(2020),
                releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)),
            )
        }
    }

    @Test
    fun `new book effective release year is derived from the date when one is given`() {
        val withoutDate = NewBook(title = Title("Dune"), releaseYear = ReleaseYear(2020))
        assertEquals(ReleaseYear(2020), withoutDate.effectiveReleaseYear)

        val withDate = NewBook(
            title = Title("Dune"),
            releaseYear = ReleaseYear(2020),
            releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)),
        )
        assertEquals(ReleaseYear(1965), withDate.effectiveReleaseYear)
    }

    @Test
    fun `patch setting a date forces the year even when a contradicting year is also given`() {
        val book = book("Dune", releaseYear = 2020)

        val patched = BookPatch(
            releaseYear = ReleaseYear(1999),
            releaseDate = Patch.Change(ReleaseDate(LocalDate.of(1965, 8, 1))),
        ).applyTo(book, book.types, book.authors)

        assertEquals(ReleaseYear(1965), patched.releaseYear)
        assertEquals(ReleaseDate(LocalDate.of(1965, 8, 1)), patched.releaseDate)
    }

    @Test
    fun `patch with only a year on a dated book is overridden by the date's year`() {
        val book = book("Dune", releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)))

        val patched = BookPatch(releaseYear = ReleaseYear(2020)).applyTo(book, book.types, book.authors)

        assertEquals(ReleaseYear(1965), patched.releaseYear)
        assertEquals(ReleaseDate(LocalDate.of(1965, 8, 1)), patched.releaseDate)
    }

    @Test
    fun `patch clearing the date keeps the current year when no year is given`() {
        val book = book("Dune", releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)))

        val patched = BookPatch(releaseDate = Patch.Change(null)).applyTo(book, book.types, book.authors)

        assertEquals(ReleaseYear(1965), patched.releaseYear)
        assertNull(patched.releaseDate)
    }

    @Test
    fun `patch clearing the date applies a given year instead of keeping the old one`() {
        val book = book("Dune", releaseDate = ReleaseDate(LocalDate.of(1965, 8, 1)))

        val patched = BookPatch(
            releaseYear = ReleaseYear(2020),
            releaseDate = Patch.Change(null),
        ).applyTo(book, book.types, book.authors)

        assertEquals(ReleaseYear(2020), patched.releaseYear)
        assertNull(patched.releaseDate)
    }
}
