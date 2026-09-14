package de.sluit.mediatracker.web

import de.sluit.mediatracker.api.HealthResponse
import de.sluit.mediatracker.plugins.SESSION_AUTH
import io.ktor.http.CacheControl
import io.ktor.server.auth.authenticate
import io.ktor.server.http.content.staticResources
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

private const val ONE_YEAR_SECONDS = 31_536_000

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
