package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.intQueryParameter
import de.sluit.mediatracker.common.api.pageRequest
import de.sluit.mediatracker.common.api.searchTerm
import de.sluit.mediatracker.common.api.toResponse
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.ExpansionService
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameDeveloperService
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GameService
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route

/**
 * /api/games. Mounted inside the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes].
 * Handlers only translate HTTP <-> domain and delegate to [GameService]; they never touch persistence.
 * A game's expansions ([expansionRoutes]) are mounted inside its `/{id}` block; cover image search
 * ([coverOptionRoutes]) and the developer vocabulary (`/game-developers`) are game-independent and mounted
 * directly under `/games`/at the top level.
 */
fun Route.gameRoutes(
    gameService: GameService,
    expansionService: ExpansionService,
    coverOptionsService: CoverOptionsService,
    developerService: GameDeveloperService,
) {
    route("/games") {
        post {
            val game = gameService.create(call.receive<CreateGameRequest>().toNewGame())
            call.response.header(HttpHeaders.Location, "/api/games/${game.id}")
            call.respond(HttpStatusCode.Created, game.toResponse())
        }
        // Ordered by title, id, unless `?sort=` (MT-026) asks for release date or rating order instead; with
        // `?search=` titles starting with the term first, then by title relevance (see GameService.list).
        // `?platformIds=`/`?ownership=`/`?progress=`/`?releaseYear=` (each repeatable) and `?rated=` narrow the
        // listing further and take the same branch as a search.
        get {
            call.respond(
                gameService.list(call.pageRequest(), call.searchTerm(), call.gameFilters(), call.gameSort())
                    .toResponse(Game::toResponse),
            )
        }
        coverOptionRoutes(coverOptionsService)
        route("/{id}") {
            patch {
                val id = call.gameId()
                val game = gameService.update(id, call.receive<UpdateGameRequest>().toPatch())
                call.respond(game.toResponse())
            }
            delete {
                gameService.delete(call.gameId())
                call.respond(HttpStatusCode.NoContent)
            }
            expansionRoutes(expansionService)
        }
    }
    route("/game-platforms") {
        get {
            call.respond(gameService.listPlatforms().map { it.toResponse() })
        }
    }
    route("/games.meta") {
        get {
            call.respond(gameService.meta().toResponse())
        }
    }
    route("/game-developers") {
        get {
            val term = call.searchTerm()
            val limit = call.intQueryParameter(VocabularySearchLimit.FIELD)?.let(::VocabularySearchLimit)
                ?: VocabularySearchLimit.DEFAULT
            call.respond(developerService.search(term, limit).map { it.toResponse() })
        }
        post {
            val request = call.receive<CreateGameDeveloperRequest>()
            val result = developerService.create(VocabularyName.parse(request.name))
            val status = if (result.created) HttpStatusCode.Created else HttpStatusCode.OK
            call.respond(status, result.entry.toResponse())
        }
    }
}

internal fun ApplicationCall.gameId(): GameId =
    GameId.parse(parameters["id"] ?: throw InvalidValueException(GameId.FIELD, "is missing"))
