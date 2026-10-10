package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.MergeVocabularyRequest
import de.sluit.mediatracker.common.api.RenameVocabularyRequest
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
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameDeveloperService
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GamePlatformService
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
    platformService: GamePlatformService,
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
        post {
            val (label, color) = call.receive<CreateGamePlatformRequest>().toLabelAndColor()
            val platform = platformService.create(label, color)
            call.response.header(HttpHeaders.Location, "/api/game-platforms/${platform.id}")
            call.respond(HttpStatusCode.Created, platform.toResponse())
        }
        route("/{id}") {
            // 404 for an unknown platform, 409 `name_taken` (with the holder) when another platform has the label.
            patch {
                val id = call.gamePlatformId()
                val (label, color) = call.receive<UpdateGamePlatformRequest>().toLabelAndColor()
                call.respond(platformService.update(id, label, color).toResponse())
            }
            // 404 for an unknown platform, 409 while a game still references it.
            delete {
                platformService.delete(call.gamePlatformId())
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
    route("/game-platforms.summaries") {
        get {
            call.respond(platformService.summaries().map { it.toResponse() })
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
        route("/{id}") {
            // Unpaged; ordered by release year, date (undated last), title, id. Unknown developer is a 404.
            get("/games") {
                call.respond(gameService.listByDeveloper(call.gameDeveloperId()).map { it.toResponse() })
            }
            // Rename. 404 for an unknown developer, 409 `name_taken` (with the holder) when another developer has the name.
            patch {
                val id = call.gameDeveloperId()
                val name = VocabularyName.parse(call.receive<RenameVocabularyRequest>().name)
                call.respond(developerService.rename(id, name).toResponse())
            }
            // Folds this developer into `targetId` and answers the target. 404 when either is unknown, 400 for itself.
            post("/merge") {
                val id = call.gameDeveloperId()
                val targetId = GameDeveloperId.parse(call.receive<MergeVocabularyRequest>().targetId, "targetId")
                call.respond(developerService.merge(id, targetId).toResponse())
            }
            // 404 for an unknown developer, 409 while a game still references it.
            delete {
                developerService.delete(call.gameDeveloperId())
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
    route("/game-developers.summaries") {
        get {
            call.respond(developerService.summaries().map { it.toResponse() })
        }
    }
}

internal fun ApplicationCall.gameId(): GameId =
    GameId.parse(parameters["id"] ?: throw InvalidValueException(GameId.FIELD, "is missing"))

private fun ApplicationCall.gamePlatformId(): GamePlatformId =
    GamePlatformId.parse(parameters["id"] ?: throw InvalidValueException(GamePlatformId.FIELD, "is missing"))

private fun ApplicationCall.gameDeveloperId(): GameDeveloperId =
    GameDeveloperId.parse(parameters["id"] ?: throw InvalidValueException(GameDeveloperId.FIELD, "is missing"))
