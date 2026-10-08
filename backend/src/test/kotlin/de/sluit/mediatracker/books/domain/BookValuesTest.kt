package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.author
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
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
    fun `book type label must be non-blank and at most 64 characters`() {
        rejects("label") { BookTypeLabel("") }
        rejects("label") { BookTypeLabel("   ") }
        rejects("label") { BookTypeLabel("x".repeat(65)) }
        assertEquals(64, BookTypeLabel("x".repeat(64)).value.length)
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
