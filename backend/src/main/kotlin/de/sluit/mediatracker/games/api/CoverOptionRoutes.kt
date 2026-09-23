package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.intQueryParameter
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.CoverType
import de.sluit.mediatracker.games.domain.ReleaseYear
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/**
 * `/cover-options`, mounted directly under `/games` by [gameRoutes] (game-independent since MT-017's follow-up:
 * there is no game id here). `?query=` (required) is the SteamGridDB search term, `?releaseYear=` (optional)
 * breaks ties between exact title matches, `?match=` picks a specific candidate instead of the one the domain
 * ranking would choose, `?type=` selects static (default) or animated grids and `?page=` selects a 1-based page
 * of the selected match's covers; there is no `?pageSize=` (the adapter always asks SteamGridDB for its maximum).
 * Handlers only translate HTTP <-> domain and delegate to [CoverOptionsService]; they never touch the SteamGridDB
 * adapter directly.
 */
fun Route.coverOptionRoutes(service: CoverOptionsService) {
    get("/cover-options") {
        val query = call.coverQuery()
        val releaseYear = call.coverReleaseYear()
        val match = call.coverMatch()
        val type = call.coverType()
        val page = call.coverPage()
        call.respond(service.find(query, releaseYear, match, type, page).toResponse())
    }
}

private const val QUERY_FIELD = "query"

private fun ApplicationCall.coverQuery(): SearchTerm =
    SearchTerm.parseOrNull(request.queryParameters[QUERY_FIELD], field = QUERY_FIELD)
        ?: throw InvalidValueException(QUERY_FIELD, "must not be blank")

private fun ApplicationCall.coverReleaseYear(): ReleaseYear? =
    request.queryParameters[ReleaseYear.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(::parseReleaseYear)

private fun ApplicationCall.coverMatch(): CoverSourceGameId? =
    request.queryParameters[CoverSourceGameId.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(CoverSourceGameId::parse)

private fun ApplicationCall.coverType(): CoverType =
    request.queryParameters[CoverType.FIELD]?.trim()?.takeIf { it.isNotEmpty() }?.let(CoverType::from)
        ?: CoverType.DEFAULT

private fun ApplicationCall.coverPage(): PageNumber =
    intQueryParameter(PageNumber.FIELD)?.let(::PageNumber) ?: PageNumber.FIRST
