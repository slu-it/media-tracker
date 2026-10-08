package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.Book
import de.sluit.mediatracker.books.domain.BookAuthor
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookMeta
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookPatch
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.NewBook
import de.sluit.mediatracker.common.api.PatchField
import de.sluit.mediatracker.common.api.PatchFieldSerializer
import de.sluit.mediatracker.common.api.toPatch
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.releaseYearFromYearOrDate
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/**
 * POST /api/books. [releaseYear] is required unless [releaseDate] is given, in which case the date's year is
 * used instead (and overrides a [releaseYear] that contradicts it); see [toNewBook]. [typeIds] and [authorIds]
 * may be empty.
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
)

/**
 * PATCH /api/books/{id}: every field optional; `description`/`coverImageUrl`/`releaseDate: null` clears the
 * field. `typeIds` and `authorIds`, when present, replace the full set and may be empty. `ownership` and
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
)

@Serializable
data class BookTypeResponse(val id: String, val label: String, val associatedColor: String)

@Serializable
data class BookAuthorResponse(val id: String, val name: String)

/** POST /book-authors */
@Serializable
data class CreateBookAuthorRequest(val name: String)

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
)

/** GET /api/books.meta: the filter values that actually occur in the stored books, pre-ordered by the domain. */
@Serializable
data class BookMetaResponse(
    val types: List<BookTypeResponse>,
    val ownership: List<String>,
    val progress: List<String>,
    val releaseYears: List<Int>,
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
    description = description.toPatch(::Description),
    coverImageUrl = coverImageUrl.toPatch(::CoverImageUrl),
    ownership = ownership?.let(BookOwnership::from),
    progress = progress?.let(BookProgress::from),
    releaseDate = releaseDate.toPatch(ReleaseDate::parse),
)

fun BookType.toResponse() = BookTypeResponse(id = id.toString(), label = label.value, associatedColor = color.value)

fun BookAuthor.toResponse() = BookAuthorResponse(id = id.toString(), name = name.value)

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
)

fun BookMeta.toResponse() = BookMetaResponse(
    types = types.map { it.toResponse() },
    ownership = ownership.map { it.wire },
    progress = progress.map { it.wire },
    releaseYears = releaseYears.map { it.value },
)
