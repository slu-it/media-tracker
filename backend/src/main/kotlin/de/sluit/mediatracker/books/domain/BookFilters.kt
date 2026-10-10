package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.WireEnum
import de.sluit.mediatracker.common.domain.fromWire

/**
 * Narrows a book listing: empty per-category sets mean "no filter on that category", non-empty sets OR their
 * values within their own category, and the categories AND together. [missing] is one such category: a book
 * matches it when ANY of the listed [BookMissingField]s is null on that book. [isEmpty] decides whether
 * [BookService.list] takes the filtered ([BookRepository.search]) or the plain ([BookRepository.findPage])
 * branch.
 */
data class BookFilters(
    val typeIds: Set<BookTypeId> = emptySet(),
    val ownership: Set<BookOwnership> = emptySet(),
    val progress: Set<BookProgress> = emptySet(),
    val releaseYears: Set<ReleaseYear> = emptySet(),
    val missing: Set<BookMissingField> = emptySet(),
) {
    val isEmpty: Boolean
        get() = typeIds.isEmpty() && ownership.isEmpty() && progress.isEmpty() && releaseYears.isEmpty() &&
            missing.isEmpty()

    companion object {
        val NONE = BookFilters()
    }
}

/**
 * A book property that can be absent, as the `hasMissing` filter names it. The wire value is the field's own
 * name, not `name.lowercase()`, exactly like the games' `MissingField`, so an agent passes back the field it saw
 * as `null` in a book.
 */
enum class BookMissingField(override val wire: String) : WireEnum {
    DESCRIPTION(Description.FIELD),
    COVER_IMAGE_URL(CoverImageUrl.FIELD),
    ;

    companion object {
        const val FIELD = "hasMissing"

        fun from(wire: String): BookMissingField = entries.fromWire(FIELD, wire)
    }
}

/**
 * The filter values that actually occur in the stored books, in the order the frontend should offer them; see
 * [BookService.meta].
 */
data class BookMeta(
    val types: List<BookType>,
    val ownership: List<BookOwnership>,
    val progress: List<BookProgress>,
    val releaseYears: List<ReleaseYear>,
    val typeCounts: Map<BookTypeId, Int>,
)

/**
 * The filter values in use across all stored books, as [BookRepository.findUsedFilterValues] returns them:
 * [typeCounts] maps each used type id to the number of books using it (so its keys are the used ids), the other
 * categories are plain sets.
 */
data class UsedBookFilterValues(
    val typeCounts: Map<BookTypeId, Int>,
    val ownership: Set<BookOwnership>,
    val progress: Set<BookProgress>,
    val releaseYears: Set<ReleaseYear>,
)
