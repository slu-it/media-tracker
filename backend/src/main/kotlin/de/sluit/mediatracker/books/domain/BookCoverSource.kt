package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.CoverOption
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.RankableMatch
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.WireEnum
import de.sluit.mediatracker.common.domain.requireValid

/*
 * Domain ports and value objects for book cover lookup and title suggestions. Printed books and e-books come from
 * one provider (Open Library, by work), audiobooks from another (Audible, a flat product list); both are
 * implemented outward in `books.integration`, the domain never imports that package. Page numbers are 1-based
 * like everywhere else; adapters translate to their upstream's convention.
 */

/** Which provider the cover picker and title suggestions use. */
enum class BookCoverSourceKind : WireEnum {
    BOOK,
    AUDIOBOOK,
    ;

    override val wire: String get() = name.lowercase()

    companion object {
        const val FIELD = "source"
        val DEFAULT = BOOK

        fun from(wire: String): BookCoverSourceKind = entries.firstOrNull { it.wire == wire }
            ?: throw InvalidValueException(FIELD, "must be one of ${entries.joinToString { it.wire }}")
    }
}

/** Open Library work id (`OL45804W`); parsed from the `match` query parameter. */
@JvmInline
value class BookWorkId(val value: String) {
    init {
        requireValid(FIELD, PATTERN.matches(value)) { "must be an Open Library work id like OL45804W" }
    }

    override fun toString(): String = value

    companion object {
        const val FIELD = "match"
        private val PATTERN = Regex("^OL\\d+W$")

        fun parse(raw: String): BookWorkId = BookWorkId(raw)
    }
}

/** One work the book source found for a search term. */
data class BookWork(
    val id: BookWorkId,
    override val name: String,
    val authors: List<String>,
    override val releaseYear: ReleaseYear?,
    /** Whether the search hit carries a cover; works without one rank behind those with one. */
    val hasCover: Boolean = true,
) : RankableMatch

/** One audiobook product; each product is exactly one cover. */
data class Audiobook(
    val asin: String,
    val name: String,
    val authors: List<String>,
    val narrators: List<String>,
    val releaseYear: ReleaseYear?,
    val cover: CoverOption,
)

/** The cover picker's page size. */
const val BOOK_COVER_PAGE_SIZE = 50

/** Outward port to the printed/e-book provider (Open Library). Implemented in `books.integration`. */
interface BookWorkSource {
    suspend fun searchWorks(term: SearchTerm): List<BookWork>

    suspend fun findWorkCovers(id: BookWorkId, page: PageNumber, size: PageSize): Page<CoverOption>
}

/** Outward port to the audiobook provider (Audible). Implemented in `books.integration`. */
interface AudiobookSource {
    suspend fun searchAudiobooks(term: SearchTerm, page: PageNumber, size: PageSize): Page<Audiobook>
}

/** Result of [BookCoverOptionsService.find]. [matches] and [selectedMatch] are empty/null for audiobooks. */
data class BookCoverOptions(
    val query: SearchTerm,
    val source: BookCoverSourceKind,
    /** The works for [query]. Empty on pages after the first when `match` is given, and for audiobooks. */
    val matches: List<BookWork>,
    val selectedMatch: BookWorkId?,
    val covers: Page<CoverOption>,
)

/** Result of [BookCoverOptionsService.findFirstCover]: the first cover and the title it belongs to. */
data class BookCoverLookup(
    val cover: CoverOption,
    val name: String,
    val authors: List<String>,
    val releaseYear: ReleaseYear?,
)

/** One title suggestion; [narrators] is empty for [BookCoverSourceKind.BOOK]. */
data class BookTitleSuggestion(
    val name: String,
    val authors: List<String>,
    val narrators: List<String>,
    val releaseYear: ReleaseYear?,
    val source: BookCoverSourceKind,
)
