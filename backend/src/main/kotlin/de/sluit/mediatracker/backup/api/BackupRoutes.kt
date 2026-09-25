package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.backup.domain.BackupService
import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.TableImportResult
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * /api/backup: JSON export/import of every domain's tables (MT-023, ADR 0027, step 1 of backups). Mounted inside
 * the authenticated `/api` route by [de.sluit.mediatracker.apiRoutes]. The `Any?` <-> [JsonElement] conversion
 * lives here so [BackupService] and every [de.sluit.mediatracker.common.domain.BackupSource] stay free of
 * kotlinx.serialization.
 */
fun Route.backupRoutes(backupService: BackupService) {
    route("/backup") {
        get("/export") {
            call.respond(backupService.export().toJson())
        }
        post("/import") {
            val tables = call.receive<JsonObject>().toTables()
            call.respond(backupService.import(tables).toResponse())
        }
    }
}

private fun Map<String, List<BackupRow>>.toJson(): JsonObject = buildJsonObject {
    forEach { (table, rows) ->
        put(table, buildJsonArray { rows.forEach { row -> add(row.toJsonObject()) } })
    }
}

private fun BackupRow.toJsonObject(): JsonObject = buildJsonObject {
    forEach { (column, value) -> put(column, value.toJsonElement()) }
}

private fun Any?.toJsonElement(): JsonElement = when (this) {
    null -> JsonNull
    is String -> JsonPrimitive(this)
    is Long -> JsonPrimitive(this)
    is Double -> JsonPrimitive(this)
    is Boolean -> JsonPrimitive(this)
    else -> error("Unsupported backup value type ${this::class}")
}

/** A non-object body never reaches here: `call.receive<JsonObject>()` already 400s it as `invalid_body`. */
private fun JsonObject.toTables(): Map<String, List<BackupRow>> = mapValues { (table, value) ->
    (value as? JsonArray ?: throw InvalidValueException(table, "must be an array of rows"))
        .map { it.toBackupRow(table) }
}

private fun JsonElement.toBackupRow(table: String): BackupRow {
    val row = this as? JsonObject ?: throw InvalidValueException(table, "each row must be an object")
    return row.mapValues { (_, value) -> value.toBackupValue(table) }
}

private fun JsonElement.toBackupValue(table: String): Any? {
    val primitive = this as? JsonPrimitive ?: throw InvalidValueException(table, "row values must be primitive")
    return when {
        primitive is JsonNull -> null

        primitive.isString -> primitive.content

        else ->
            primitive.booleanOrNull
                ?: primitive.longOrNull
                ?: primitive.doubleOrNull
                ?: throw InvalidValueException(table, "unsupported json value: ${primitive.content}")
    }
}

private fun Map<String, TableImportResult>.toResponse() = ImportResultResponse(
    tables = mapValues { (_, result) -> TableImportResultDto(result.inserted, result.skipped) },
)
