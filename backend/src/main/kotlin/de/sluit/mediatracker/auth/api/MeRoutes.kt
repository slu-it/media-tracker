package de.sluit.mediatracker.auth.api

import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** GET /api/me; mounted inside the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes]. */
fun Route.meRoutes() {
    get("/me") {
        val session = call.principal<UserSession>() ?: error("principal missing after authenticate")
        call.respond(MeResponse(username = session.username))
    }
}
