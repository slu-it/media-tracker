package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.games.domain.GameService
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.McpJson
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import io.modelcontextprotocol.kotlin.sdk.types.ToolAnnotations
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/**
 * Registers the MCP tools this feature offers on [server]: [de.sluit.mediatracker.mcpRoutes] calls this once per
 * request for every media kind, exactly as [gameRoutes] contributes the REST routes.
 */
fun Server.addGameTools(gameService: GameService) {
    addListGamePlatformsTool(gameService)
    addAddGameTool(gameService)
    addSearchGamesTool(gameService)
}

private const val LIST_GAME_PLATFORMS_DESCRIPTION =
    "Lists the game platforms this tracker knows, with the ids add_game expects in platformIds."

private const val ADD_GAME_DESCRIPTION =
    "Adds a game to the tracker. title, releaseYear and platformIds are required. " +
        "platformIds are game_platforms.id values; call list_game_platforms first to get them. " +
        "description, rating and coverImageUrl are optional."

private const val SEARCH_GAMES_DESCRIPTION =
    "Searches the tracked games by title and description and returns the 10 best matches, title matches first, " +
        "best match first. Any word may match; each word is treated as a prefix (\"zel\" finds \"Zelda\")."

private val SEARCH_GAMES_LIMIT = PageSize(10)

// Mirrors the constraints value classes enforce in games/domain/GameValues.kt.
private val ADD_GAME_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("title") {
            put("type", "string")
            put("description", "The game's title.")
            put("minLength", 1)
            put("maxLength", 256)
        }
        putJsonObject("releaseYear") {
            put("type", "integer")
            put("description", "The four-digit release year.")
            put("minimum", 1000)
            put("maximum", 9999)
        }
        putJsonObject("platformIds") {
            put("type", "array")
            put(
                "description",
                "Ids of the platforms this game was released on, from list_game_platforms. " +
                    "At least one is required.",
            )
            putJsonObject("items") {
                put("type", "string")
                put("format", "uuid")
            }
            put("minItems", 1)
            put("uniqueItems", true)
        }
        putJsonObject("description") {
            put("type", "string")
            put("description", "Free-form notes about the game, at most 10000 characters.")
            put("minLength", 1)
            put("maxLength", 10000)
        }
        putJsonObject("rating") {
            put("type", "number")
            put("description", "A star rating between 0.25 and 5.0, in quarter-star steps.")
            put("minimum", 0.25)
            put("maximum", 5.0)
            put("multipleOf", 0.25)
        }
        putJsonObject("coverImageUrl") {
            put("type", "string")
            put("description", "An absolute http(s) URL to a cover image.")
            put("minLength", 1)
            put("maxLength", 2048)
            put("format", "uri")
        }
    },
    required = listOf("title", "releaseYear", "platformIds"),
)

private val SEARCH_GAMES_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("query") {
            put("type", "string")
            put("description", "Words to search for.")
            put("minLength", 1)
            put("maxLength", SearchTerm.MAX_LENGTH)
        }
    },
    required = listOf("query"),
)

private fun Server.addListGamePlatformsTool(gameService: GameService) {
    addTool(
        name = "list_game_platforms",
        description = LIST_GAME_PLATFORMS_DESCRIPTION,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { _ ->
        val platforms = gameService.listPlatforms().map { it.toResponse() }
        CallToolResult(
            content = listOf(TextContent(platforms.joinToString("\n") { "${it.label}: ${it.id}" })),
            structuredContent = buildJsonObject {
                putJsonArray("platforms") {
                    platforms.forEach { platform ->
                        addJsonObject {
                            put("id", platform.id)
                            put("label", platform.label)
                        }
                    }
                }
            },
        )
    }
}

private fun Server.addAddGameTool(gameService: GameService) {
    addTool(
        name = "add_game",
        description = ADD_GAME_DESCRIPTION,
        inputSchema = ADD_GAME_SCHEMA,
    ) { request ->
        try {
            val createRequest = McpJson.decodeFromJsonElement(
                CreateGameRequest.serializer(),
                request.arguments ?: JsonObject(emptyMap()),
            )
            val response = gameService.create(createRequest.toNewGame()).toResponse()
            CallToolResult(
                content = listOf(
                    TextContent(
                        "Created game \"${response.title}\" (${response.releaseYear}) with id ${response.id}.",
                    ),
                ),
                structuredContent = McpJson.encodeToJsonElement(GameResponse.serializer(), response).jsonObject,
            )
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        } catch (e: NotFoundException) {
            e.toErrorResult()
        } catch (e: SerializationException) {
            e.toErrorResult()
        }
    }
}

private fun Server.addSearchGamesTool(gameService: GameService) {
    addTool(
        name = "search_games",
        description = SEARCH_GAMES_DESCRIPTION,
        inputSchema = SEARCH_GAMES_SCHEMA,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { request ->
        try {
            val raw = when (val argument = request.arguments?.get("query")) {
                null, is JsonNull -> null

                is JsonPrimitive -> argument.takeIf { it.isString }?.content
                    ?: throw InvalidValueException("query", "must be a string")

                else -> throw InvalidValueException("query", "must be a string")
            }
            val term = SearchTerm.parseOrNull(raw, field = "query")
                ?: throw InvalidValueException("query", "must not be blank")
            val page = gameService.list(PageRequest(PageNumber.FIRST, SEARCH_GAMES_LIMIT), term)
            val games = page.items.map { it.toResponse() }
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (games.isEmpty()) {
                            "No games match \"$term\"."
                        } else {
                            // The tool never pages: say how many matches exist so a truncated list is recognisable.
                            "${games.size} of ${page.totalItems} matches for \"$term\", best first:\n" +
                                games.joinToString("\n") { "${it.title} (${it.releaseYear}): ${it.id}" }
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    put("totalMatches", page.totalItems)
                    putJsonArray("games") {
                        games.forEach { game ->
                            add(McpJson.encodeToJsonElement(GameResponse.serializer(), game))
                        }
                    }
                },
            )
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        }
    }
}

private fun Exception.toErrorResult(): CallToolResult =
    CallToolResult(content = listOf(TextContent(message ?: "invalid request")), isError = true)
