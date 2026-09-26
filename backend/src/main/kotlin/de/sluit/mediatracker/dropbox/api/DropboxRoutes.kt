package de.sluit.mediatracker.dropbox.api

import de.sluit.mediatracker.dropbox.domain.AuthorizationCode
import de.sluit.mediatracker.dropbox.domain.DropboxService
import de.sluit.mediatracker.dropbox.domain.DropboxStatus
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

/**
 * `/api/dropbox`: the in-app, no-redirect Dropbox connection (MT-024, ADR 0028). Mounted inside the authenticated
 * `/api` route by [de.sluit.mediatracker.apiRoutes]. `POST /connection`'s pasted code is untrusted user input
 * Dropbox itself can reject; [DropboxService.connect] turns that into a 400 `validation_error`, never the 502 an
 * [de.sluit.mediatracker.common.domain.ExternalSourceException] from any other call would answer with.
 */
fun Route.dropboxRoutes(service: DropboxService) {
    route("/dropbox") {
        get {
            call.respond(service.status().toResponse())
        }
        get("/authorize-url") {
            call.respond(AuthorizeUrlResponse(service.authorizeUrl()))
        }
        route("/connection") {
            post {
                val request = call.receive<ConnectDropboxRequest>()
                // Users copy-paste the code from Dropbox's page; a leading/trailing space or newline from that
                // paste must not turn into a 400 validation_error.
                val status = service.connect(AuthorizationCode(request.code.trim()))
                call.respond(status.toResponse())
            }
            delete {
                service.disconnect()
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
}

private fun DropboxStatus.toResponse() = DropboxStatusResponse(
    available = available,
    connected = connected,
    connectedAt = connectedAt?.toString(),
)
