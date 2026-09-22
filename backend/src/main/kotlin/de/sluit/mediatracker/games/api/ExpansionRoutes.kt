package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.ExpansionService
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
 * /api/games/{id}/expansions. Mounted inside [gameRoutes]'s `/{id}` block, so it shares the game id path
 * parameter with [gameId]. Handlers only translate HTTP <-> domain and delegate to [ExpansionService]; they
 * never touch persistence.
 */
fun Route.expansionRoutes(service: ExpansionService) {
    route("/expansions") {
        get {
            val gameId = call.gameId()
            call.respond(service.list(gameId).map { it.toResponse() })
        }
        post {
            val gameId = call.gameId()
            val expansion = service.create(gameId, call.receive<CreateExpansionRequest>().toNewExpansion())
            call.response.header(HttpHeaders.Location, "/api/games/$gameId/expansions/${expansion.id}")
            call.respond(HttpStatusCode.Created, expansion.toResponse())
        }
        route("/{expansionId}") {
            patch {
                val gameId = call.gameId()
                val id = call.expansionId()
                val updated = service.update(gameId, id, call.receive<UpdateExpansionRequest>().toPatch())
                call.respond(updated.toResponse())
            }
            delete {
                service.delete(call.gameId(), call.expansionId())
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
}

private fun ApplicationCall.expansionId(): ExpansionId =
    ExpansionId.parse(parameters["expansionId"] ?: throw InvalidValueException(ExpansionId.FIELD, "is missing"))
