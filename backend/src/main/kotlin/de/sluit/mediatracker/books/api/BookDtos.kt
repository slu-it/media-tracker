package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.Book
import de.sluit.mediatracker.books.domain.BookAuthor
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorSummary
import de.sluit.mediatracker.books.domain.BookMeta
import de.sluit.mediatracker.books.domain.BookNarrator
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookNarratorSummary
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookPatch
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookSeries
import de.sluit.mediatracker.books.domain.BookSeriesEntry
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesPosition
import de.sluit.mediatracker.books.domain.BookSeriesSummary
import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.NewBook
import de.sluit.mediatracker.common.api.PatchField
import de.sluit.mediatracker.common.api.PatchFieldSerializer
import de.sluit.mediatracker.common.api.toPatch
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.releaseYearFromYearOrDate
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/**
 * POST /api/books. [releaseYear] is required unless [releaseDate] is given, in which case the date's year is
 * used instead (and overrides a [releaseYear] that contradicts it); see [toNewBook]. [typeIds], [authorIds],
 * [narratorIds] and [series] may be empty.
 */
@Serializable
data class CreateBookRequest(
    val title: String,
    val releaseYear: Int? = null,
    val releaseDate: String? = null,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val ownership: String? = null,
    val progress: String? = null,
    val typeIds: List<String> = emptyList(),
    val authorIds: List<String> = emptyList(),
    val narratorIds: List<String> = emptyList(),
    val series: List<BookSeriesLinkRequest> = emptyList(),
)

/**
 * PATCH /api/books/{id}: every field optional; `description`/`coverImageUrl`/`releaseDate: null` clears the
 * field. `typeIds`, `authorIds`, `narratorIds` and `series`, when present, replace the full set and may be empty. `ownership` and
 * `progress` cannot be cleared, so they are plain nullable fields rather than `PatchField`.
 */
@Serializable
data class UpdateBookRequest(
    val title: String? = null,
    val releaseYear: Int? = null,
    @Serializable(with = PatchFieldSerializer::class)
    val releaseDate: PatchField<String> = PatchField.Absent,
    @Serializable(with = PatchFieldSerializer::class)
    val description: PatchField<String> = PatchField.Absent,
    @Serializable(with = PatchFieldSerializer::class)
    val coverImageUrl: PatchField<String> = PatchField.Absent,
    val ownership: String? = null,
    val progress: String? = null,
    val typeIds: List<String>? = null,
    val authorIds: List<String>? = null,
    val narratorIds: List<String>? = null,
    val series: List<BookSeriesLinkRequest>? = null,
)

/** One book-to-series link in a request: the series and the book's optional number in it (e.g. 1 or 2.5). */
@Serializable
data class BookSeriesLinkRequest(val seriesId: String, val position: Double? = null)

@Serializable
data class BookTypeResponse(val id: String, val label: String, val associatedColor: String)

@Serializable
data class BookAuthorResponse(val id: String, val name: String)

/** POST /book-authors */
@Serializable
data class CreateBookAuthorRequest(val name: String)

@Serializable
data class BookNarratorResponse(val id: String, val name: String)

/** POST /book-narrators */
@Serializable
data class CreateBookNarratorRequest(val name: String)

@Serializable
data class BookSeriesResponse(val id: String, val name: String)

/** GET /api/book-series.summaries: a series with the number of books linked to it (0 allowed). */
@Serializable
data class BookSeriesSummaryResponse(val id: String, val name: String, val bookCount: Int)

/** GET /api/book-authors.summaries: an author with the number of books linked to them (0 allowed). */
@Serializable
data class BookAuthorSummaryResponse(val id: String, val name: String, val bookCount: Int)

/** GET /api/book-narrators.summaries: a narrator with the number of books linked to them (0 allowed). */
@Serializable
data class BookNarratorSummaryResponse(val id: String, val name: String, val bookCount: Int)

/** POST /book-series */
@Serializable
data class CreateBookSeriesRequest(val name: String)

/** A series of a book with the book's [position] in it, `null` when it has no number. */
@Serializable
data class BookSeriesEntryResponse(val id: String, val name: String, val position: Double?)

@Serializable
data class BookResponse(
    val id: String,
    val title: String,
    val releaseYear: Int,
    val releaseDate: String?,
    val description: String?,
    val coverImageUrl: String?,
    val ownership: String,
    val progress: String,
    val types: List<BookTypeResponse>,
    val authors: List<BookAuthorResponse>,
    val narrators: List<BookNarratorResponse>,
    val series: List<BookSeriesEntryResponse>,
)

/** GET /api/books.meta: the filter values that actually occur in the stored books, pre-ordered by the domain. */
@Serializable
data class BookMetaResponse(
    val types: List<BookTypeResponse>,
    val ownership: List<String>,
    val progress: List<String>,
    val releaseYears: List<Int>,
    /** type id -> number of books using it; only used types appear. */
    val typeCounts: Map<String, Int>,
)

// DTO <-> domain conversions. Constructing the value objects is the validation; failures surface as 400.

fun CreateBookRequest.toNewBook(): NewBook {
    val parsedReleaseDate = releaseDate?.let(ReleaseDate::parse)
    val year = releaseYearFromYearOrDate(releaseYear, parsedReleaseDate)
    return NewBook(
        title = Title(title),
        releaseYear = year,
        typeIds = typeIds.map(BookTypeId::parse).toSet(),
        authorIds = authorIds.map(BookAuthorId::parse).toSet(),
        narratorIds = narratorIds.map(BookNarratorId::parse).toSet(),
        series = series.toPositions(),
        description = description?.let(::Description),
        coverImageUrl = coverImageUrl?.let(::CoverImageUrl),
        ownership = ownership?.let(BookOwnership::from) ?: BookOwnership.DEFAULT,
        progress = progress?.let(BookProgress::from) ?: BookProgress.DEFAULT,
        releaseDate = parsedReleaseDate,
    )
}

fun UpdateBookRequest.toPatch() = BookPatch(
    title = title?.let(::Title),
    releaseYear = releaseYear?.let(::ReleaseYear),
    typeIds = typeIds?.map(BookTypeId::parse)?.toSet(),
    authorIds = authorIds?.map(BookAuthorId::parse)?.toSet(),
    narratorIds = narratorIds?.map(BookNarratorId::parse)?.toSet(),
    series = series?.toPositions(),
    description = description.toPatch(::Description),
    coverImageUrl = coverImageUrl.toPatch(::CoverImageUrl),
    ownership = ownership?.let(BookOwnership::from),
    progress = progress?.let(BookProgress::from),
    releaseDate = releaseDate.toPatch(ReleaseDate::parse),
)

/** A series may be linked once per book; a repeated id is a client error, not something to merge silently. */
private fun List<BookSeriesLinkRequest>.toPositions(): Map<BookSeriesId, BookSeriesPosition?> {
    val positions = LinkedHashMap<BookSeriesId, BookSeriesPosition?>()
    forEach { link ->
        val id = BookSeriesId.parse(link.seriesId)
        val position = link.position?.let(BookSeriesPosition::fromDouble)
        if (positions.containsKey(id)) throw InvalidValueException(BookSeriesId.FIELD, "must not contain duplicates")
        positions[id] = position
    }
    return positions
}

fun BookType.toResponse() = BookTypeResponse(id = id.toString(), label = label.value, associatedColor = color.value)

fun BookAuthor.toResponse() = BookAuthorResponse(id = id.toString(), name = name.value)

fun BookNarrator.toResponse() = BookNarratorResponse(id = id.toString(), name = name.value)

fun BookSeries.toResponse() = BookSeriesResponse(id = id.toString(), name = name.value)

fun BookAuthorSummary.toResponse() =
    BookAuthorSummaryResponse(id = author.id.toString(), name = author.name.value, bookCount = bookCount)

fun BookNarratorSummary.toResponse() =
    BookNarratorSummaryResponse(id = narrator.id.toString(), name = narrator.name.value, bookCount = bookCount)

fun BookSeriesSummary.toResponse() =
    BookSeriesSummaryResponse(id = series.id.toString(), name = series.name.value, bookCount = bookCount)

fun BookSeriesEntry.toResponse() =
    BookSeriesEntryResponse(id = series.id.toString(), name = series.name.value, position = position?.value?.toDouble())

fun Book.toResponse() = BookResponse(
    id = id.toString(),
    title = title.value,
    releaseYear = releaseYear.value,
    releaseDate = releaseDate?.value?.toString(),
    description = description?.value,
    coverImageUrl = coverImageUrl?.value,
    ownership = ownership.wire,
    progress = progress.wire,
    types = types.map { it.toResponse() },
    authors = authors.map { it.toResponse() },
    narrators = narrators.map { it.toResponse() },
    series = series.map { it.toResponse() },
)

fun BookMeta.toResponse() = BookMetaResponse(
    types = types.map { it.toResponse() },
    ownership = ownership.map { it.wire },
    progress = progress.map { it.wire },
    releaseYears = releaseYears.map { it.value },
    typeCounts = typeCounts.mapKeys { it.key.toString() },
)
