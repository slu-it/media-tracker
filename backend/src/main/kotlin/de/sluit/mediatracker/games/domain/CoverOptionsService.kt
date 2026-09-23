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
            val covers = activeSource.findCovers(match, type, page)
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
        val covers = selected?.let { activeSource.findCovers(it, type, page) }
            ?: Page(emptyList(), page, PageSize(COVER_PAGE_SIZE), 0)

        return CoverOptions(query = query, matches = matches, selectedMatchId = selected, type = type, covers = covers)
    }

    companion object {
        const val SOURCE = "cover_source"
    }
}
