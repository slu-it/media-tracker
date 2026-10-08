package de.sluit.mediatracker.books

import de.sluit.mediatracker.books.domain.Book
import de.sluit.mediatracker.books.domain.BookAuthor
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.books.domain.sortedByNameForBook
import de.sluit.mediatracker.books.domain.sortedForBook
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import kotlin.uuid.Uuid

/** The four book types seeded by db/migration/V012__books.sql, as domain objects, for use in fixtures. */
object BookTypes {
    val HARDCOVER = BookType(
        BookTypeId(Uuid.parseHexDash(SeededBookTypes.HARDCOVER)),
        BookTypeLabel("Hardcover"),
        HexColor("5D4037"),
    )
    val PAPERBACK = BookType(
        BookTypeId(Uuid.parseHexDash(SeededBookTypes.PAPERBACK)),
        BookTypeLabel("Paperback"),
        HexColor("00796B"),
    )
    val KINDLE = BookType(
        BookTypeId(Uuid.parseHexDash(SeededBookTypes.KINDLE)),
        BookTypeLabel("Kindle"),
        HexColor("1A73B5"),
    )
    val AUDIBLE = BookType(
        BookTypeId(Uuid.parseHexDash(SeededBookTypes.AUDIBLE)),
        BookTypeLabel("Audible"),
        HexColor("F7991C"),
    )
}

/** Builds a valid [BookAuthor] for tests, with a random id unless one is given. */
fun author(name: String, id: BookAuthorId = BookAuthorId.new()): BookAuthor = BookAuthor(id, VocabularyName(name))

/**
 * Builds a valid [Book] for tests, defaulting to no types and no authors. When [releaseDate] is given, it
 * decides the year (like production: [releaseYear] is ignored then), so callers only need one of the two.
 */
fun book(
    title: String,
    types: List<BookType> = emptyList(),
    id: BookId = BookId.new(),
    releaseYear: Int = 2018,
    description: Description? = null,
    coverImageUrl: CoverImageUrl? = null,
    ownership: BookOwnership = BookOwnership.DEFAULT,
    progress: BookProgress = BookProgress.DEFAULT,
    releaseDate: ReleaseDate? = null,
    authors: List<BookAuthor> = emptyList(),
): Book = Book(
    id = id,
    title = Title(title),
    releaseYear = releaseDate?.let { ReleaseYear(it.year) } ?: ReleaseYear(releaseYear),
    types = types.sortedForBook(),
    authors = authors.sortedByNameForBook(),
    description = description,
    coverImageUrl = coverImageUrl,
    ownership = ownership,
    progress = progress,
    releaseDate = releaseDate,
)
