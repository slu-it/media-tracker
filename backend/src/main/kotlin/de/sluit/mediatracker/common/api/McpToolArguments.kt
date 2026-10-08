package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull

/*
 * Argument helpers shared by the MCP tools of every media kind. McpJson swallows unknown keys and coerces
 * loosely, so tools read their arguments through these strict accessors and reject what they do not know.
 */

/** Rejects argument names outside [allowed]: McpJson would ignore a typo'd name and silently do something else. */
internal fun JsonObject.requireKnownFields(allowed: Set<String>) {
    val unknown = keys - allowed
    requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
}

/** Rejects an explicit `null` for any of [fields], which cannot be cleared. */
internal fun JsonObject.requireNotCleared(fields: Set<String>) {
    fields.forEach { field ->
        requireValid(field, this[field] !is JsonNull) { "cannot be cleared" }
    }
}

/** An optional integer argument that, when present, must lie in `1..max`. */
internal fun JsonObject.sizeOrNull(field: String, max: Int): Int? = intOrNull(field)?.also { requested ->
    requireValid(field, requested in 1..max) { "must be between 1 and $max" }
}

internal fun JsonObject.stringOrNull(field: String): String? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonPrimitive -> argument.takeIf { it.isString }?.content
        ?: throw InvalidValueException(field, "must be a string")

    else -> throw InvalidValueException(field, "must be a string")
}

internal fun JsonObject.stringArrayOrNull(field: String): List<String>? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonArray -> argument.map { element ->
        (element as? JsonPrimitive)?.takeIf { it.isString }?.content
            ?: throw InvalidValueException(field, "must be an array of strings")
    }

    else -> throw InvalidValueException(field, "must be an array of strings")
}

internal fun JsonObject.intArrayOrNull(field: String): List<Int>? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonArray -> argument.map { element ->
        (element as? JsonPrimitive)?.intOrNull
            ?: throw InvalidValueException(field, "must be an array of integers")
    }

    else -> throw InvalidValueException(field, "must be an array of integers")
}

internal fun JsonObject.intOrNull(field: String): Int? = when (val argument = this[field]) {
    null, is JsonNull -> null
    is JsonPrimitive -> argument.intOrNull ?: throw InvalidValueException(field, "must be an integer")
    else -> throw InvalidValueException(field, "must be an integer")
}

internal fun JsonObject.booleanOrNull(field: String): Boolean? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonPrimitive -> argument.takeIf { !it.isString }?.booleanOrNull
        ?: throw InvalidValueException(field, "must be a boolean")

    else -> throw InvalidValueException(field, "must be a boolean")
}

internal fun Exception.toErrorResult(): CallToolResult =
    CallToolResult(content = listOf(TextContent(message ?: "invalid request")), isError = true)
