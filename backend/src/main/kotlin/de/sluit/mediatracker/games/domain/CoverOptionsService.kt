package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Business use case behind the cover picker (MT-017, ADR 0024). [source] is `null` when SteamGridDB is not
 * configured; that is checked first, before the game is even looked up, so an unconfigured instance never
 * touches the repository.
 */
class CoverOptionsService(private val games: GameRepository, private val source: CoverSource?) {
    suspend fun find(
        gameId: GameId,
        query: SearchTerm?,
        match: CoverSourceGameId?,
        type: CoverType,
        page: PageNumber,
    ): CoverOptions {
        val activeSource = source ?: throw ExternalSourceUnavailableException(SOURCE)
        val game = games.findById(gameId) ?: throw NotFoundException(GameService.RESOURCE, gameId.toString())
        val term = query ?: defaultSearchTerm(game.title)

        // The frontend only reads `matches` from page 1; every later page of an already-chosen match would
        // otherwise re-run the search for a result it discards.
        if (match != null && page != PageNumber.FIRST) {
            val covers = activeSource.findCovers(match, type, page)
            return CoverOptions(
                query = term,
                matches = emptyList(),
                selectedMatchId = match,
                type = type,
                covers = covers,
            )
        }

        val matches = activeSource.searchGames(term)
        val selected = match ?: selectBestMatch(matches, game.title, game.releaseYear)?.id
        val covers = selected?.let { activeSource.findCovers(it, type, page) }
            ?: Page(emptyList(), page, PageSize(COVER_PAGE_SIZE), 0)

        return CoverOptions(query = term, matches = matches, selectedMatchId = selected, type = type, covers = covers)
    }

    /** The game's title, trimmed and bounded to [SearchTerm.MAX_LENGTH]: [Title] allows more than [SearchTerm] does. */
    private fun defaultSearchTerm(title: Title): SearchTerm =
        SearchTerm(title.value.trim().take(SearchTerm.MAX_LENGTH).trim())

    companion object {
        const val SOURCE = "cover_source"
    }
}
