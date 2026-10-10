package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.selectBestMatch
import org.slf4j.LoggerFactory

/**
 * Use case behind the book cover picker and title suggestions. Mirrors the games `CoverOptionsService`; both
 * providers are always wired, so there is no "unavailable" path. Upstream failures surface as
 * [ExternalSourceException] from [find] and [findFirstCover] and degrade to an empty list in [suggestTitles]
 * (ADR 0026).
 */
class BookCoverOptionsService(private val works: BookWorkSource, private val audiobooks: AudiobookSource) {
    private val log = LoggerFactory.getLogger(BookCoverOptionsService::class.java)

    suspend fun find(
        query: SearchTerm,
        releaseYear: ReleaseYear?,
        source: BookCoverSourceKind,
        match: BookWorkId?,
        page: PageNumber,
    ): BookCoverOptions = when (source) {
        BookCoverSourceKind.BOOK -> findBookCovers(query, releaseYear, match, page)

        BookCoverSourceKind.AUDIOBOOK -> {
            if (match != null) throw InvalidValueException(BookWorkId.FIELD, "is not supported for audiobooks")
            val products = audiobooks.searchAudiobooks(query, page, PageSize(BOOK_COVER_PAGE_SIZE))
            BookCoverOptions(query, source, emptyList(), null, products.map { it.cover })
        }
    }

    private suspend fun findBookCovers(
        query: SearchTerm,
        releaseYear: ReleaseYear?,
        match: BookWorkId?,
        page: PageNumber,
    ): BookCoverOptions {
        val source = BookCoverSourceKind.BOOK
        val size = PageSize(BOOK_COVER_PAGE_SIZE)

        // Later pages of an already-chosen match would otherwise re-run a search whose result is discarded.
        if (match != null && page != PageNumber.FIRST) {
            return BookCoverOptions(query, source, emptyList(), match, works.findWorkCovers(match, page, size))
        }

        val matches = works.searchWorks(query)
        val selected = match ?: bestMatch(matches, query, releaseYear)?.id
        val covers = selected?.let { works.findWorkCovers(it, page, size) } ?: Page(emptyList(), page, size, 0)
        return BookCoverOptions(query, source, matches, selected, covers)
    }

    /**
     * Used by the MCP `find_book_cover` tool: one cover plus the title it belongs to, or `null` when nothing
     * matches or the match has no covers.
     */
    suspend fun findFirstCover(
        title: SearchTerm,
        releaseYear: ReleaseYear?,
        source: BookCoverSourceKind,
    ): BookCoverLookup? = when (source) {
        BookCoverSourceKind.BOOK -> {
            val match = bestMatch(works.searchWorks(title), title, releaseYear)
            val cover = match?.let { works.findWorkCovers(it.id, PageNumber.FIRST, PageSize(1)).items.firstOrNull() }
            if (match == null ||
                cover == null
            ) {
                null
            } else {
                BookCoverLookup(cover, match.name, match.authors, match.releaseYear)
            }
        }

        BookCoverSourceKind.AUDIOBOOK -> {
            val products = audiobooks.searchAudiobooks(title, PageNumber.FIRST, PageSize(1)).items
            products.firstOrNull()?.let { BookCoverLookup(it.cover, it.name, it.authors, it.releaseYear) }
        }
    }

    /** Backs the title-suggestion autocomplete; deduplicated, capped, and `[]` on upstream failure. */
    suspend fun suggestTitles(query: SearchTerm, source: BookCoverSourceKind): List<BookTitleSuggestion> = try {
        val suggestions = when (source) {
            BookCoverSourceKind.BOOK -> works.searchWorks(query).map {
                BookTitleSuggestion(it.name, it.authors, emptyList(), it.releaseYear, source)
            }

            BookCoverSourceKind.AUDIOBOOK ->
                audiobooks
                    .searchAudiobooks(query, PageNumber.FIRST, PageSize(BOOK_COVER_PAGE_SIZE))
                    .items
                    .map { BookTitleSuggestion(it.name, it.authors, it.narrators, it.releaseYear, source) }
        }
        suggestions.distinctBy { it.name.normalized() to it.authors.firstOrNull()?.normalized() }
            .take(TITLE_SUGGESTION_LIMIT)
    } catch (e: ExternalSourceException) {
        log.warn("External source '${e.source}' call failed", e)
        emptyList()
    }

    /** Ranks only works with a cover so the picker is not empty; falls back to all works when none has one. */
    private fun bestMatch(matches: List<BookWork>, query: SearchTerm, releaseYear: ReleaseYear?): BookWork? =
        selectBestMatch(matches.filter { it.hasCover }.ifEmpty { matches }, query, releaseYear)

    private fun String.normalized(): String = trim().lowercase().replace(Regex("\\s+"), " ")

    companion object {
        const val TITLE_SUGGESTION_LIMIT = 8
    }
}
