package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import io.modelcontextprotocol.kotlin.sdk.types.ToolAnnotations
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/** A vocabulary entry as the tools show it: the [id] other tools' id arguments expect, and its [name]. */
data class VocabularyEntryView(val id: String, val name: String)

/**
 * Registers a read-only vocabulary search tool, e.g. `search_game_developers`. Reads `query` and `pageSize`
 * (capped at [VocabularySearchLimit.MAX]) from the arguments, rejecting any name that [inputSchema] does not
 * declare, and answers one `name: id` line per match plus structured content `{ <entryNounPlural>: [{id, name}] }`.
 */
internal fun Server.addSearchVocabularyTool(
    name: String,
    description: String,
    inputSchema: ToolSchema,
    entryNounPlural: String,
    search: suspend (SearchTerm?, VocabularySearchLimit) -> List<VocabularyEntryView>,
) {
    val knownFields = inputSchema.properties!!.keys
    addTool(
        name = name,
        description = description,
        inputSchema = inputSchema,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            arguments.requireKnownFields(knownFields)
            val term = SearchTerm.parseOrNull(arguments.stringOrNull("query"), field = "query")
            val limit = arguments.sizeOrNull("pageSize", VocabularySearchLimit.MAX)?.let(::VocabularySearchLimit)
                ?: VocabularySearchLimit.DEFAULT
            val entries = search(term, limit)
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (entries.isEmpty()) {
                            "No $entryNounPlural found."
                        } else {
                            entries.joinToString("\n") { "${it.name}: ${it.id}" }
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    putJsonArray(entryNounPlural) {
                        entries.forEach { entry ->
                            addJsonObject {
                                put("id", entry.id)
                                put("name", entry.name)
                            }
                        }
                    }
                },
            )
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        }
    }
}

/**
 * Registers an idempotent vocabulary create tool, e.g. `create_game_developer`. [create] receives the raw
 * arguments (already checked against [knownFields]) and decodes them itself, since the request DTO is the
 * kind's own. Answers a sentence naming the [entryNoun] plus structured content `{ id, name, created }`.
 */
internal fun Server.addCreateVocabularyTool(
    name: String,
    description: String,
    inputSchema: ToolSchema,
    knownFields: Set<String>,
    entryNoun: String,
    create: suspend (JsonObject) -> VocabularyCreation<VocabularyEntryView>,
) {
    addTool(name = name, description = description, inputSchema = inputSchema) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            arguments.requireKnownFields(knownFields)
            val result = create(arguments)
            val response = result.entry
            val capitalized = entryNoun.replaceFirstChar { it.uppercase() }
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (result.created) {
                            "Created $entryNoun \"${response.name}\" with id ${response.id}."
                        } else {
                            "$capitalized \"${response.name}\" already exists with id ${response.id}."
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    put("id", response.id)
                    put("name", response.name)
                    put("created", result.created)
                },
            )
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        } catch (e: SerializationException) {
            e.toErrorResult()
        }
    }
}
