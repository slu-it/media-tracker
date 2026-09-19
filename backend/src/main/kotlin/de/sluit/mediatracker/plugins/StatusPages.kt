package de.sluit.mediatracker.plugins

import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.install
import io.ktor.server.application.log
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.ContentTransformationException
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.path
import io.ktor.server.response.respond
import io.ktor.server.response.respondText

/**
 * Maps exceptions and bare status codes to responses. Routes under `/api` and `/mcp` get a JSON [ErrorResponse];
 * everything else gets plain text. StatusPages picks the most specific registered exception type, so the domain
 * exceptions below win over the `Throwable` fallback.
 *
 * | Exception                                     | Status | code               |
 * |-----------------------------------------------|--------|--------------------|
 * | [InvalidValueException] (value object rejected) | 400  | `validation_error` |
 * | [BadRequestException] (malformed/ill-typed body) | 400 | `invalid_body`     |
 * | [ContentTransformationException] (no/unsupported body) | 400 | `invalid_body` |
 * | [NotFoundException]                           | 404    | `not_found`        |
 * | anything else                                 | 500    | `internal_error`   |
 */
fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<InvalidValueException> { call, cause ->
            call.respondError(HttpStatusCode.BadRequest, "validation_error", cause.message)
        }
        exception<NotFoundException> { call, _ ->
            call.respondError(HttpStatusCode.NotFound, "not_found")
        }
        exception<BadRequestException> { call, cause ->
            // Ktor wraps the kotlinx.serialization failure; its message carries the offending field but also
            // the raw JSON input after a line break, which is not something to echo back. kotlinx.coroutines'
            // stack trace recovery can additionally re-wrap the exception in same-typed copies as it crosses
            // suspension points, so skip past those before reading the underlying cause.
            val detail =
                generateSequence(cause.cause) { it.cause }
                    .firstOrNull { it !is BadRequestException }
                    ?.message
                    ?.lineSequence()
                    ?.firstOrNull()
            call.respondError(HttpStatusCode.BadRequest, "invalid_body", detail)
        }
        exception<ContentTransformationException> { call, _ ->
            call.respondError(HttpStatusCode.BadRequest, "invalid_body")
        }
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled error on ${call.request.path()}", cause)
            call.respondError(HttpStatusCode.InternalServerError, "internal_error", text = "Internal server error")
        }
        status(HttpStatusCode.NotFound) { call, status ->
            call.respondError(status, "not_found", text = "Not found")
        }
    }
}

private fun ApplicationCall.isApiCall() =
    request.path().startsWith("/api/") || request.path().removeSuffix("/") == "/mcp"

private suspend fun ApplicationCall.respondError(
    status: HttpStatusCode,
    code: String,
    message: String? = null,
    text: String = message ?: code,
) {
    if (isApiCall()) {
        respond(status, ErrorResponse(code, message))
    } else {
        respondText(text, status = status)
    }
}
