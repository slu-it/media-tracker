package de.sluit.mediatracker.api

import de.sluit.mediatracker.auth.UserSession
import de.sluit.mediatracker.games.api.gameRoutes
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.plugins.SESSION_AUTH
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

/**
 * JSON API under /api. Everything here requires a valid session.
 * Each feature contributes its routes from its own `api` package (e.g. [gameRoutes]); this function only
 * mounts them inside the authenticated `/api` prefix.
 */
fun Route.apiRoutes(gameService: GameService) {
    authenticate(SESSION_AUTH) {
        route("/api") {
            get("/me") {
                val session = call.principal<UserSession>() ?: error("principal missing after authenticate")
                call.respond(MeResponse(username = session.username))
            }

            gameRoutes(gameService)

            // Unknown API paths must answer JSON 404 instead of falling through to the SPA's index.html.
            route("{...}") {
                handle {
                    call.respond(HttpStatusCode.NotFound, ErrorResponse("not_found"))
                }
            }
        }
    }
}
