package de.sluit.mediatracker.plugins

import de.sluit.mediatracker.api.ErrorResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.application.log
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.path
import io.ktor.server.response.respond
import io.ktor.server.response.respondText

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled error on ${call.request.path()}", cause)
            if (call.request.path().startsWith("/api/")) {
                call.respond(HttpStatusCode.InternalServerError, ErrorResponse("internal_error"))
            } else {
                call.respondText("Internal server error", status = HttpStatusCode.InternalServerError)
            }
        }
        status(HttpStatusCode.NotFound) { call, status ->
            if (call.request.path().startsWith("/api/")) {
                call.respond(status, ErrorResponse("not_found"))
            } else {
                call.respondText("Not found", status = status)
            }
        }
    }
}
