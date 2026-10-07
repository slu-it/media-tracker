package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.NewPassword
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.sessions.sessionId

/**
 * PUT /api/me/password; mounted inside the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes], next
 * to [apiKeyRoutes]. Translates HTTP <-> domain and delegates to [AuthService.changePassword]; the response
 * carries no body but is still marked `no-store` like the API-key routes.
 */
fun Route.passwordRoutes(auth: AuthService) {
    route("/me/password") {
        put {
            val session = call.principal<UserSession>() ?: error("principal missing after authenticate")
            val sessionId = call.sessionId<UserSession>() ?: error("session id missing after authenticate")
            val request = call.receive<ChangePasswordRequest>()
            auth.changePassword(
                username = session.username,
                userId = session.userId,
                keepSessionId = sessionId,
                current = request.currentPassword.toCharArray(),
                new = NewPassword(request.newPassword),
            )
            call.response.header(HttpHeaders.CacheControl, "no-store")
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
