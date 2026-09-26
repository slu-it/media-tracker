package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.backup.domain.BackupService
import de.sluit.mediatracker.backup.domain.CloudBackupService
import de.sluit.mediatracker.common.domain.StoredFile
import de.sluit.mediatracker.common.domain.TableImportResult
import io.ktor.http.ContentType
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.JsonObject

/**
 * /api/backup: JSON export/import of every domain's tables (MT-023, ADR 0027) and the Dropbox cloud backup
 * (MT-024, ADR 0028). Mounted inside the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes]. The
 * `Any?` <-> JSON conversion lives in [JsonBackupCodec], shared with [CloudBackupService] so `GET
 * /api/backup/export`'s download and the Dropbox upload are byte-for-byte identical bytes.
 */
fun Route.backupRoutes(backupService: BackupService, cloudBackupService: CloudBackupService) {
    val codec = JsonBackupCodec()
    route("/backup") {
        get("/export") {
            call.respondBytes(codec.encode(backupService.export()), ContentType.Application.Json)
        }
        post("/import") {
            val tables = codec.decode(call.receive<JsonObject>())
            call.respond(backupService.import(tables).toResponse())
        }
        route("/dropbox") {
            get {
                call.respond(CloudBackupResponse(cloudBackupService.lastBackup()?.toDto()))
            }
            post {
                val stored = cloudBackupService.backupNow()
                call.respond(CloudBackupResponse(stored.toDto()))
            }
        }
    }
}

private fun StoredFile.toDto() = StoredFileDto(modifiedAt.toString(), sizeBytes)

private fun Map<String, TableImportResult>.toResponse() = ImportResultResponse(
    tables = mapValues { (_, result) -> TableImportResultDto(result.inserted, result.skipped) },
)
