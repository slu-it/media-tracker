package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.intQueryParameter
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.CoverType
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/**
 * /api/games/{id}/cover-options. Mounted inside [gameRoutes]'s `/{id}` block, next to [expansionRoutes], so it
 * shares the game id path parameter with [gameId]. `?query=` overrides the game's title as the SteamGridDB
 * search term, `?match=` picks a specific candidate instead of the one the domain ranking would choose, `?type=`
 * selects static (default) or animated grids and `?page=` selects a 1-based page of the selected match's covers;
 * all four are optional and there is no `?pageSize=` (the adapter always asks SteamGridDB for its maximum).
 * Handlers only translate HTTP <-> domain and delegate to [CoverOptionsService]; they never touch the SteamGridDB
 * adapter directly.
 */
fun Route.coverOptionRoutes(service: CoverOptionsService) {
    get("/cover-options") {
        val gameId = call.gameId()
        val query = call.coverQuery()
        val match = call.coverMatch()
        val type = call.coverType()
        val page = call.coverPage()
        call.respond(service.find(gameId, query, match, type, page).toResponse())
    }
}

private const val QUERY_FIELD = "query"

private fun ApplicationCall.coverQuery(): SearchTerm? =
    SearchTerm.parseOrNull(request.queryParameters[QUERY_FIELD], field = QUERY_FIELD)

private fun ApplicationCall.coverMatch(): CoverSourceGameId? =
    request.queryParameters[CoverSourceGameId.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(CoverSourceGameId::parse)

private fun ApplicationCall.coverType(): CoverType =
    request.queryParameters[CoverType.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(CoverType::from)
        ?: CoverType.DEFAULT

private fun ApplicationCall.coverPage(): PageNumber =
    intQueryParameter(PageNumber.FIELD)?.let(::PageNumber) ?: PageNumber.FIRST
