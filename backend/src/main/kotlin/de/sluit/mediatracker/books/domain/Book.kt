package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.applyTo
import de.sluit.mediatracker.common.domain.effectiveReleaseYear
import de.sluit.mediatracker.common.domain.requireReleaseYearMatches
import de.sluit.mediatracker.common.domain.requireValid
import de.sluit.mediatracker.common.domain.resolvePatchedReleaseYear

/** A selectable type (hardcover, Kindle, ...) a book can come in; the rows are seeded by the books migration. */
data class BookType(val id: BookTypeId, val label: BookTypeLabel, val color: HexColor)

/** Sorts by label case-insensitively, then id, so the order is deterministic and duplicate-free. */
fun List<BookType>.sortedForBook(): List<BookType> = distinctBy { it.id }
    .sortedWith(compareBy({ it.label.value.lowercase() }, { it.id.toString() }))

/**
 * What the user-grown vocabularies of a book (authors, narrators, series) share: an id (its type differs per
 * vocabulary, hence [Any]; only equality and [toString] are used) and a [name]. One generic sort helper over it
 * avoids a JVM signature clash between per-type `List<...>` extension functions.
 */
interface BookNamedEntry {
    val id: Any
    val name: VocabularyName
}

/** An author the user has added to the vocabulary; grown on the fly, unlike [BookType]. */
data class BookAuthor(override val id: BookAuthorId, override val name: VocabularyName) : BookNamedEntry

/** A narrator the user has added to the vocabulary; works exactly like [BookAuthor]. */
data class BookNarrator(override val id: BookNarratorId, override val name: VocabularyName) : BookNamedEntry

/** A series the user has added to the vocabulary; works like [BookAuthor], the position is on the link. */
data class BookSeries(override val id: BookSeriesId, override val name: VocabularyName) : BookNamedEntry

/** A series with the number of books linked to it (0 for a series nobody references yet). */
data class BookSeriesSummary(val series: BookSeries, val bookCount: Int)

/** A book's link to one [series], with the book's optional [position] (number) in it. */
data class BookSeriesEntry(val series: BookSeries, val position: BookSeriesPosition? = null) : BookNamedEntry {
    override val id: Any get() = series.id
    override val name: VocabularyName get() = series.name
}

/**
 * Sorts by name case-insensitively, then id, so the order is deterministic and duplicate-free. Named
 * differently from [BookType]'s `sortedForBook` (identical after generic erasure) to avoid a JVM signature
 * clash between the two extension functions.
 */
fun <T : BookNamedEntry> List<T>.sortedByNameForBook(): List<T> = distinctBy { it.id }
    .sortedWith(compareBy({ it.name.value.lowercase() }, { it.id.toString() }))

/** A book as the business layer sees it. All fields are validated value objects. */
data class Book(
    val id: BookId,
    val title: Title,
    val releaseYear: ReleaseYear,
    val types: List<BookType> = emptyList(),
    val authors: List<BookAuthor> = emptyList(),
    val narrators: List<BookNarrator> = emptyList(),
    val series: List<BookSeriesEntry> = emptyList(),
    val description: Description? = null,
    val coverImageUrl: CoverImageUrl? = null,
    val ownership: BookOwnership = BookOwnership.DEFAULT,
    val progress: BookProgress = BookProgress.DEFAULT,
    val releaseDate: ReleaseDate? = null,
) {
    init {
        requireValid(BookTypeId.FIELD, types.map { it.id }.distinct().size == types.size) {
            "must not contain duplicates"
        }
        requireValid(BookTypeId.FIELD, types == types.sortedForBook()) { "must be sorted by label" }
        requireValid(BookAuthorId.FIELD, authors.map { it.id }.distinct().size == authors.size) {
            "must not contain duplicates"
        }
        requireValid(BookAuthorId.FIELD, authors == authors.sortedByNameForBook()) { "must be sorted by name" }
        requireValid(BookNarratorId.FIELD, narrators.map { it.id }.distinct().size == narrators.size) {
            "must not contain duplicates"
        }
        requireValid(BookNarratorId.FIELD, narrators == narrators.sortedByNameForBook()) { "must be sorted by name" }
        requireValid(BookSeriesId.FIELD, series.map { it.id }.distinct().size == series.size) {
            "must not contain duplicates"
        }
        requireValid(BookSeriesId.FIELD, series == series.sortedByNameForBook()) { "must be sorted by name" }
        requireReleaseYearMatches(releaseYear, releaseDate)
    }
}

/**
 * Everything needed to create a book; the id is assigned by [BookService]. [releaseYear] is the year as
 * requested; when [releaseDate] is also given, [effectiveReleaseYear] (what [BookService.create] actually
 * stores) derives the year from the date instead, overriding a contradicting [releaseYear]. Types, authors,
 * narrators and series may all be empty; [series] maps each series id to the book's optional position in it.
 */
data class NewBook(
    val title: Title,
    val releaseYear: ReleaseYear,
    val typeIds: Set<BookTypeId> = emptySet(),
    val authorIds: Set<BookAuthorId> = emptySet(),
    val narratorIds: Set<BookNarratorId> = emptySet(),
    val series: Map<BookSeriesId, BookSeriesPosition?> = emptyMap(),
    val description: Description? = null,
    val coverImageUrl: CoverImageUrl? = null,
    val ownership: BookOwnership = BookOwnership.DEFAULT,
    val progress: BookProgress = BookProgress.DEFAULT,
    val releaseDate: ReleaseDate? = null,
) {
    val effectiveReleaseYear: ReleaseYear get() = effectiveReleaseYear(releaseYear, releaseDate)
}

/**
 * Partial update. Required fields use `null` for "leave unchanged" (they can never be cleared); the optional
 * fields use [Patch] so that "unchanged" and "clear" stay distinguishable. `typeIds`, `authorIds`, `narratorIds`
 * and `series` are `null` for "unchanged" too, and can be cleared to an empty set. `releaseDate` wins over `releaseYear` whenever both
 * would otherwise apply, see [applyTo].
 */
data class BookPatch(
    val title: Title? = null,
    val releaseYear: ReleaseYear? = null,
    val typeIds: Set<BookTypeId>? = null,
    val authorIds: Set<BookAuthorId>? = null,
    val narratorIds: Set<BookNarratorId>? = null,
    val series: Map<BookSeriesId, BookSeriesPosition?>? = null,
    val description: Patch<Description> = Patch.Unchanged,
    val coverImageUrl: Patch<CoverImageUrl> = Patch.Unchanged,
    val ownership: BookOwnership? = null,
    val progress: BookProgress? = null,
    val releaseDate: Patch<ReleaseDate> = Patch.Unchanged,
) {
    /**
     * [types], [authors], [narrators] and [seriesEntries] must already be the resolved, sorted replacements when
     * [typeIds] / [authorIds] / [narratorIds] / [series] are non-null. The resolved release date decides the year: a date present after this patch (whether just set or
     * already there and left unchanged) always wins, overriding a contradicting [releaseYear]; only when no date
     * is present (never set, or just cleared) does a given [releaseYear] apply, else the book's current year is
     * kept.
     */
    fun applyTo(
        book: Book,
        types: List<BookType>,
        authors: List<BookAuthor>,
        narrators: List<BookNarrator> = book.narrators,
        seriesEntries: List<BookSeriesEntry> = book.series,
    ): Book {
        val resolvedReleaseDate = releaseDate.applyTo(book.releaseDate)
        val resolvedReleaseYear = resolvePatchedReleaseYear(releaseYear, resolvedReleaseDate, book.releaseYear)
        return book.copy(
            title = title ?: book.title,
            releaseYear = resolvedReleaseYear,
            types = if (typeIds != null) types else book.types,
            authors = if (authorIds != null) authors else book.authors,
            narrators = if (narratorIds != null) narrators else book.narrators,
            series = if (series != null) seriesEntries else book.series,
            description = description.applyTo(book.description),
            coverImageUrl = coverImageUrl.applyTo(book.coverImageUrl),
            ownership = ownership ?: book.ownership,
            progress = progress ?: book.progress,
            releaseDate = resolvedReleaseDate,
        )
    }
}
