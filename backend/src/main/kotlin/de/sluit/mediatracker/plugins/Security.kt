package de.sluit.mediatracker.plugins

import de.sluit.mediatracker.api.ErrorResponse
import de.sluit.mediatracker.auth.UserSession
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.session
import io.ktor.server.request.path
import io.ktor.server.response.respond
import io.ktor.server.response.respondRedirect

/** Name of the authentication provider used by `authenticate(SESSION_AUTH) { ... }`. */
const val SESSION_AUTH = "session"

/**
 * Session-based authentication. The session itself was already validated (existence + expiry) by the
 * database-backed storage when Ktor read the cookie, so `validate` only has to accept it.
 * Unauthenticated API calls get a JSON 401; unauthenticated browser navigation is redirected to /login.
 */
fun Application.configureSecurity() {
    install(Authentication) {
        session<UserSession>(SESSION_AUTH) {
            validate { session -> session }
            challenge {
                if (call.request.path().startsWith("/api/")) {
                    call.respond(HttpStatusCode.Unauthorized, ErrorResponse("unauthorized"))
                } else {
                    call.respondRedirect("/login")
                }
            }
        }
    }
}
