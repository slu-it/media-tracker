package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.common.api.ErrorResponse
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.AuthenticationFailedCause
import io.ktor.server.auth.session
import io.ktor.server.request.ApplicationRequest
import io.ktor.server.request.header
import io.ktor.server.request.path
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondRedirect

/** Name of the authentication provider used by `authenticate(SESSION_AUTH) { ... }`. */
const val SESSION_AUTH = "session"

/** Name of the authentication provider used by `authenticate(API_KEY_AUTH) { ... }`. */
const val API_KEY_AUTH = "api-key"

/** Header carrying a raw API key, checked before falling back to a `Bearer` `Authorization` header. */
const val API_KEY_HEADER = "X-API-Key"

/** The user identified by a valid API key on a route that names [API_KEY_AUTH]. */
data class ApiKeyPrincipal(val userId: Long, val username: String)

/**
 * Three authentication tiers, all on one port:
 *  - Public: `/login`, static files under `/login/static`, `/logout`, `/health`.
 *  - [SESSION_AUTH]: the browser session cookie, consulted for the SPA and every route under `/api`.
 *    Unauthenticated API calls get a JSON 401; unauthenticated browser navigation is redirected to /login.
 *    The session itself was already validated (existence + expiry) by the database-backed storage when Ktor
 *    read the cookie, so `validate` only has to accept it.
 *  - [API_KEY_AUTH]: an [X-API-Key][API_KEY_HEADER] header or a `Bearer` `Authorization` header, only consulted
 *    on the routes that explicitly name this provider (e.g. the MCP endpoint); it is never combined with
 *    [SESSION_AUTH] on the same route, so a stray API key header does not authenticate session-gated routes.
 */
fun Application.configureSecurity(apiKeyService: ApiKeyService) {
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
        provider(API_KEY_AUTH) {
            authenticate { context ->
                val rawKey = context.call.request.apiKey()
                if (rawKey == null) {
                    context.challenge(API_KEY_AUTH, AuthenticationFailedCause.NoCredentials) { challenge, call ->
                        call.respondUnauthorized()
                        challenge.complete()
                    }
                    return@authenticate
                }
                val user = apiKeyService.authenticate(rawKey)
                if (user == null) {
                    context.challenge(API_KEY_AUTH, AuthenticationFailedCause.InvalidCredentials) { challenge, call ->
                        call.respondUnauthorized()
                        challenge.complete()
                    }
                    return@authenticate
                }
                context.principal(API_KEY_AUTH, ApiKeyPrincipal(user.id, user.username))
            }
        }
    }
}

/** Reads the raw key from [API_KEY_HEADER], else from a `Bearer` `Authorization` header, else null. */
private fun ApplicationRequest.apiKey(): String? {
    header(API_KEY_HEADER)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    val authorization = header(HttpHeaders.Authorization)?.trim() ?: return null
    return if (authorization.startsWith("Bearer ", ignoreCase = true)) {
        authorization.substring(7).trim().takeIf { it.isNotEmpty() }
    } else {
        null
    }
}

private suspend fun ApplicationCall.respondUnauthorized() {
    response.header(HttpHeaders.WWWAuthenticate, "Bearer realm=\"media-tracker\"")
    respond(HttpStatusCode.Unauthorized, ErrorResponse("unauthorized"))
}
