package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Business use case behind the cover picker (MT-017, ADR 0024). Game-independent: the caller supplies the search
 * [SearchTerm] (and, optionally, a release year to break ranking ties) directly, rather than this service looking
 * up a stored game. [source] is `null` when SteamGridDB is not configured; that is checked first, before any
 * search runs.
 */
class CoverOptionsService(private val source: CoverSource?) {
    /** Whether SteamGridDB is configured; checked by the MCP tool to decide whether to register itself at all. */
    val isAvailable: Boolean get() = source != null

    suspend fun find(
        query: SearchTerm,
        releaseYear: ReleaseYear?,
        match: CoverSourceGameId?,
        type: CoverType,
        page: PageNumber,
    ): CoverOptions {
        val activeSource = source ?: throw ExternalSourceUnavailableException(SOURCE)

        // The frontend only reads `matches` from page 1; every later page of an already-chosen match would
        // otherwise re-run the search for a result it discards.
        if (match != null && page != PageNumber.FIRST) {
            val covers = activeSource.findCovers(match, type, page, PageSize(COVER_PAGE_SIZE))
            return CoverOptions(
                query = query,
                matches = emptyList(),
                selectedMatchId = match,
                type = type,
                covers = covers,
            )
        }

        val matches = activeSource.searchGames(query)
        val selected = match ?: selectBestMatch(matches, query, releaseYear)?.id
        val covers = selected?.let { activeSource.findCovers(it, type, page, PageSize(COVER_PAGE_SIZE)) }
            ?: Page(emptyList(), page, PageSize(COVER_PAGE_SIZE), 0)

        return CoverOptions(query = query, matches = matches, selectedMatchId = selected, type = type, covers = covers)
    }

    /**
     * Used by the MCP `find_game_cover` tool: ranks [query] the same way [find] does, but only ever fetches one
     * cover, so a caller that only wants a URL for `coverImageUrl` does not pull (and discard) a whole page of
     * covers. Returns `null` when nothing matches, or the match has no covers. Accepted trade-off of that single
     * fetch: if the adapter drops the one grid on that page as invalid, this returns `null` even though a later
     * page might have held a usable cover.
     */
    suspend fun findFirstCover(query: SearchTerm, releaseYear: ReleaseYear?): CoverLookup? {
        val activeSource = source ?: throw ExternalSourceUnavailableException(SOURCE)

        val matches = activeSource.searchGames(query)
        val match = selectBestMatch(matches, query, releaseYear) ?: return null
        val covers = activeSource.findCovers(match.id, CoverType.STATIC, PageNumber.FIRST, PageSize(1))
        val cover = covers.items.firstOrNull() ?: return null
        return CoverLookup(match, cover)
    }

    companion object {
        const val SOURCE = "cover_source"
    }
}
