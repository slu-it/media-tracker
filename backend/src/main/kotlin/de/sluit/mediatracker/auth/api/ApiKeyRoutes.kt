package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.ApiKeySlot
import de.sluit.mediatracker.common.domain.InvalidValueException
import io.ktor.http.HttpHeaders
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.principal
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

/**
 * /api/me/api-keys; mounted inside the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes].
 * Handlers only translate HTTP <-> domain and delegate to [ApiKeyService]. Both responses carry secrets, so both
 * are marked `no-store` to keep them out of any cache.
 */
fun Route.apiKeyRoutes(service: ApiKeyService) {
    route("/me/api-keys") {
        get {
            val session = call.principal<UserSession>() ?: error("principal missing after authenticate")
            call.response.header(HttpHeaders.CacheControl, "no-store")
            call.respond(service.keysFor(session.userId).toResponse())
        }
        post("/{slot}") {
            val session = call.principal<UserSession>() ?: error("principal missing after authenticate")
            val slot = call.slot()
            call.response.header(HttpHeaders.CacheControl, "no-store")
            call.respond(service.regenerate(session.userId, slot).toResponse())
        }
    }
}

private fun ApplicationCall.slot(): ApiKeySlot = when (parameters["slot"]) {
    "primary" -> ApiKeySlot.PRIMARY
    "secondary" -> ApiKeySlot.SECONDARY
    else -> throw InvalidValueException("slot", "must be primary or secondary")
}
