package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.pageRequest
import de.sluit.mediatracker.common.api.toResponse
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.games.domain.Game
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
 */
fun Route.gameRoutes(gameService: GameService) {
    route("/games") {
        post {
            val game = gameService.create(call.receive<CreateGameRequest>().toNewGame())
            call.response.header(HttpHeaders.Location, "/api/games/${game.id}")
            call.respond(HttpStatusCode.Created, game.toResponse())
        }
        get {
            call.respond(gameService.list(call.pageRequest()).toResponse(Game::toResponse))
        }
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
        }
    }
    route("/game-platforms") {
        get {
            call.respond(gameService.listPlatforms().map { it.toResponse() })
        }
    }
}

private fun ApplicationCall.gameId(): GameId =
    GameId.parse(parameters["id"] ?: throw InvalidValueException(GameId.FIELD, "is missing"))
