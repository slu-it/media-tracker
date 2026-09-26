package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.backup.domain.BackupEncoder
import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.InvalidValueException
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
 * JSON <-> [BackupRow] conversion for the backup export/import (MT-023, MT-024, ADR 0027/0028). [encode]
 * implements [BackupEncoder]: it backs `GET /api/backup/export` (`backupRoutes`) and
 * `de.sluit.mediatracker.backup.domain.CloudBackupService`, so the downloaded file and the Dropbox upload are
 * byte-for-byte identical UTF-8 JSON. [decode] backs `POST /api/backup/import`; it stays here (not on
 * [BackupEncoder]) because it takes the [JsonObject] Ktor's content negotiation already parsed, a kotlinx type
 * the domain must not import.
 */
class JsonBackupCodec : BackupEncoder {
    override fun encode(snapshot: Map<String, List<BackupRow>>): ByteArray =
        snapshot.toJson().toString().encodeToByteArray()

    /** A non-object body never reaches here: `call.receive<JsonObject>()` already 400s it as `invalid_body`. */
    fun decode(json: JsonObject): Map<String, List<BackupRow>> = json.toTables()
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
