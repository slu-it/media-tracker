package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.config.SessionConfig
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.sessions.SessionStorage
import io.ktor.server.sessions.SessionTransportTransformerMessageAuthentication
import io.ktor.server.sessions.Sessions
import io.ktor.server.sessions.cookie

/**
 * Server-side sessions: the cookie holds only a random session id, HMAC-signed with `session.secret`
 * so ids cannot be forged or tampered with; the payload lives in the database via [storage].
 */
fun Application.configureSessions(config: SessionConfig, storage: SessionStorage) {
    install(Sessions) {
        cookie<UserSession>(config.cookieName, storage) {
            cookie.path = "/"
            cookie.httpOnly = true
            cookie.secure = config.secureCookie
            cookie.extensions["SameSite"] = "Lax"
            cookie.maxAgeInSeconds = config.maxAge.inWholeSeconds
            transform(SessionTransportTransformerMessageAuthentication(config.secret.toByteArray()))
        }
    }
}
