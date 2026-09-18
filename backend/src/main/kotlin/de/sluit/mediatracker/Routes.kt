package de.sluit.mediatracker

// Composition root's route registrations: feature routes come from `<feature>/api/*Routes.kt` and are
// mounted here (`apiRoutes`), while `webRoutes` serves `/health` and the SPA.

import de.sluit.mediatracker.auth.api.SESSION_AUTH
import de.sluit.mediatracker.auth.api.meRoutes
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.api.HealthResponse
import de.sluit.mediatracker.games.api.gameRoutes
import de.sluit.mediatracker.games.domain.GameService
import io.ktor.http.CacheControl
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.authenticate
import io.ktor.server.http.content.staticResources
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

private const val ONE_YEAR_SECONDS = 31_536_000

/**
 * JSON API under /api. Everything here requires a valid session.
 * Each feature contributes its routes from its own `api` package (e.g. [meRoutes], [gameRoutes]); this
 * function only mounts them inside the authenticated `/api` prefix.
 */
fun Route.apiRoutes(gameService: GameService) {
    authenticate(SESSION_AUTH) {
        route("/api") {
            meRoutes()

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

/**
 * Static tier.
 *  - /health is public (systemd / uptime checks).
 *  - The compiled React app (classpath /app, filled by :backend:processResources) is served at /
 *    behind the session gate. Unknown paths fall back to index.html for client-side routing.
 *    Everything is `private`: Vite's hashed assets may be cached long-term, index.html never.
 */
fun Route.webRoutes() {
    get("/health") {
        call.respond(HealthResponse())
    }

    authenticate(SESSION_AUTH) {
        staticResources("/", "app") {
            default("index.html")
            cacheControl { url ->
                if (url.path.contains("/assets/")) {
                    listOf(CacheControl.MaxAge(ONE_YEAR_SECONDS, visibility = CacheControl.Visibility.Private))
                } else {
                    listOf(CacheControl.NoCache(CacheControl.Visibility.Private))
                }
            }
        }
    }
}
