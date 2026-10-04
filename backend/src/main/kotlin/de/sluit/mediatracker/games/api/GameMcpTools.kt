package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.requireValid
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.DeveloperName
import de.sluit.mediatracker.games.domain.DeveloperSearchLimit
import de.sluit.mediatracker.games.domain.ExpansionService
import de.sluit.mediatracker.games.domain.GameDeveloperService
import de.sluit.mediatracker.games.domain.GameFilters
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.games.domain.GameSort
import de.sluit.mediatracker.games.domain.MissingField
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.ReleaseYear
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.McpJson
import io.modelcontextprotocol.kotlin.sdk.types.TextContent
import io.modelcontextprotocol.kotlin.sdk.types.ToolAnnotations
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.elementNames
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import org.slf4j.LoggerFactory

// No enclosing class to hang a member logger off, unlike e.g. auth/domain/ApiKeyService.
private val log = LoggerFactory.getLogger("de.sluit.mediatracker.games.api.GameMcpTools")

/**
 * Registers the MCP tools this feature offers on [server]: [de.sluit.mediatracker.mcpRoutes] calls this once per
 * request for every media kind, exactly as [gameRoutes] contributes the REST routes. `find_game_cover` is only
 * registered when [coverOptionsService] is available (SteamGridDB is configured); it is silently absent from
 * `tools/list` otherwise, rather than failing every call.
 */
fun Server.addGameTools(
    gameService: GameService,
    expansionService: ExpansionService,
    coverOptionsService: CoverOptionsService,
    developerService: GameDeveloperService,
) {
    addListGamePlatformsTool(gameService)
    addAddGameTool(gameService)
    addSearchGamesTool(gameService)
    addUpdateGameTool(gameService)
    addListExpansionsTool(expansionService)
    addAddExpansionTool(expansionService)
    addSearchGameDevelopersTool(developerService)
    addCreateGameDeveloperTool(developerService)
    if (coverOptionsService.isAvailable) {
        addFindGameCoverTool(coverOptionsService)
    }
}

private const val LIST_GAME_PLATFORMS_DESCRIPTION =
    "Lists the game platforms this tracker knows, with the ids add_game expects in platformIds."

private const val ADD_GAME_DESCRIPTION =
    "Adds a game to the tracker. title and platformIds are required; releaseYear is required unless " +
        "releaseDate is given, in which case the date's year is used instead (and overrides a releaseYear " +
        "that contradicts it), so releaseYear may then be omitted. " +
        "platformIds are game_platforms.id values; call list_game_platforms first to get them. " +
        "description, rating and coverImageUrl are optional. developerIds are optional game_developers.id " +
        "values; call search_game_developers first to look them up, and create_game_developer for any " +
        "developer that search does not find. ownership, progress and hidden are also optional: " +
        "ownership defaults to watchlist, progress defaults to not_started (completed means fully finished, " +
        "100%), and hidden defaults to false."

private const val SEARCH_GAMES_DESCRIPTION =
    "Searches the tracked games by title and description and returns the best matches - at most pageSize of " +
        "them, 10 by default - title matches first, " +
        "best match first. Any word may match; each word is treated as a prefix (\"zel\" finds \"Zelda\"). " +
        "platformIds, ownership, progress, releaseYears and rated narrow the search: several values inside one " +
        "filter mean \"any of\" (e.g. ownership: [\"owned\",\"watchlist\"] matches either), but every filter " +
        "that is given has to match. rated: true restricts to games that already have a rating. platformIds " +
        "are game_platforms.id values; call list_game_platforms first to get them. hasMissing finds games " +
        "whose description or cover image is still empty, so they can be filled in with update_game. sort " +
        "orders the matches: title (default) alphabetically, release_asc/release_desc by release date (oldest/" +
        "newest first), rating_desc by rating (highest first) - e.g. sort: \"rating_desc\", rated: true and " +
        "releaseYears: [2024] together rank 2024's games by rating. At least one of query or a filter is " +
        "required (sort alone does not count as one). Each match carries the id update_game needs to change " +
        "it. pageSize controls how many matches come back, 10 by default and 100 at most."

private const val LIST_EXPANSIONS_DESCRIPTION =
    "Lists a game's expansions - DLC that belongs to that game - in their stored order. gameId is the game's " +
        "id as returned by search_games - never guess or invent one; if you only have the game's title, look " +
        "it up with search_games first."

private const val ADD_EXPANSION_DESCRIPTION =
    "Adds an expansion - DLC that belongs to a game already tracked - and appends it at the end of that " +
        "game's existing expansion order. gameId is the game's id as returned by search_games - never guess or " +
        "invent one; if you only have the game's title, look it up with search_games first. title is required. " +
        "ownership and progress are optional: ownership defaults to watchlist, progress defaults to " +
        "not_started (completed means fully finished, 100%)."

private const val FIND_GAME_COVER_DESCRIPTION =
    "Looks up a cover image for a game on SteamGridDB. Pass the game's full official title; passing the " +
        "release year as well improves the ranking when several games share a similar title. Returns the " +
        "first static cover of the best-matching SteamGridDB game, together with that match itself - check " +
        "match.name (and its year) before trusting the image, since the match can be wrong. On a hit, pass " +
        "the returned imageUrl as coverImageUrl to add_game or update_game. This tool is only available when " +
        "SteamGridDB is configured; search_games with hasMissing: [\"coverImageUrl\"] finds tracked games that " +
        "still need one."

private const val UPDATE_GAME_DESCRIPTION =
    "Updates a game that is already tracked. id is the game's id as returned by search_games - never guess or " +
        "invent one; users refer to games by title, so look the game up with search_games first. If the search " +
        "returns more than one plausible match (sequels and series entries often have nearly identical titles), " +
        "ask the user which one they mean and update nothing until they answer. Pass only the fields that " +
        "should change; every field you omit keeps its current value. description, rating, coverImageUrl and " +
        "releaseDate accept null to clear the field (clearing releaseDate keeps the game's current releaseYear, " +
        "it does not clear it too); title, releaseYear, platformIds, ownership, progress and hidden cannot be " +
        "cleared. platformIds, when given, replaces the whole platform list (ids from list_game_platforms), it " +
        "does not add to it. developerIds, when given, replaces the whole developer list (ids from " +
        "search_game_developers; create missing ones with create_game_developer first) - an empty array clears " +
        "it, it does not need null. progress's completed value means fully finished, 100%. Passing nothing but " +
        "id, or a field name that is not in the schema, is an error."

/** What `search_games` returns when the caller names no `pageSize`; its ceiling is [SEARCH_GAMES_MAX_SIZE]. */
private val SEARCH_GAMES_DEFAULT_SIZE = PageSize(10)

/** The tool's own cap, deliberately below `PageSize`'s 200: a tool result is prose in someone's context window. */
private const val SEARCH_GAMES_MAX_SIZE = 100

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
            put(
                "description",
                "The four-digit release year. Required unless releaseDate is given, whose year then wins.",
            )
            put("minimum", 1000)
            put("maximum", 9999)
        }
        putJsonObject("releaseDate") {
            put("type", "string")
            put("format", "date")
            put(
                "description",
                "The game's precise release date (YYYY-MM-DD). Optional; when given, its year overrides " +
                    "releaseYear, which then may be omitted.",
            )
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
        putJsonObject("ownership") {
            put("type", "string")
            putJsonArray("enum") { Ownership.entries.forEach { add(it.wire) } }
            put(
                "description",
                "Whether the game is owned, available through a subscription (e.g. PlayStation Plus, Game Pass), " +
                    "or just on the watchlist. Defaults to watchlist.",
            )
        }
        putJsonObject("progress") {
            put("type", "string")
            putJsonArray("enum") { Progress.entries.forEach { add(it.wire) } }
            put(
                "description",
                "How far the game has been played. completed means fully finished (100%). " +
                    "Defaults to not_started.",
            )
        }
        putJsonObject("hidden") {
            put("type", "boolean")
            put("description", "Whether the game is hidden from the default list view. Defaults to false.")
        }
        putJsonObject("developerIds") {
            put("type", "array")
            put(
                "description",
                "Ids of the developers who made this game, from search_game_developers (create missing ones " +
                    "with create_game_developer). Optional.",
            )
            putJsonObject("items") {
                put("type", "string")
                put("format", "uuid")
            }
            put("uniqueItems", true)
        }
    },
    required = listOf("title", "platformIds"),
)

// Mirrors GameFilters; the enum arrays are built from the domain entries so the schema cannot drift from it.
private val SEARCH_GAMES_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("query") {
            put("type", "string")
            put("description", "Words to search for.")
            put("minLength", 1)
            put("maxLength", SearchTerm.MAX_LENGTH)
        }
        putJsonObject("platformIds") {
            put("type", "array")
            put(
                "description",
                "Only games released on one of these platforms, ids from list_game_platforms.",
            )
            putJsonObject("items") {
                put("type", "string")
                put("format", "uuid")
            }
            put("uniqueItems", true)
            put("maxItems", MAX_FILTER_VALUES)
        }
        putJsonObject("ownership") {
            put("type", "array")
            put("description", "Only games whose ownership is one of these values.")
            putJsonObject("items") {
                put("type", "string")
                putJsonArray("enum") { Ownership.entries.forEach { add(it.wire) } }
            }
            put("uniqueItems", true)
            put("maxItems", MAX_FILTER_VALUES)
        }
        putJsonObject("progress") {
            put("type", "array")
            put("description", "Only games whose progress is one of these values.")
            putJsonObject("items") {
                put("type", "string")
                putJsonArray("enum") { Progress.entries.forEach { add(it.wire) } }
            }
            put("uniqueItems", true)
            put("maxItems", MAX_FILTER_VALUES)
        }
        putJsonObject("releaseYears") {
            put("type", "array")
            put("description", "Only games released in one of these years.")
            putJsonObject("items") {
                put("type", "integer")
                put("minimum", ReleaseYear.MIN)
                put("maximum", ReleaseYear.MAX)
            }
            put("uniqueItems", true)
            put("maxItems", MAX_FILTER_VALUES)
        }
        putJsonObject(MissingField.FIELD) {
            put("type", "array")
            put(
                "description",
                "Only games where at least one of these properties has no value yet. Use it to find games " +
                    "with incomplete data.",
            )
            putJsonObject("items") {
                put("type", "string")
                putJsonArray("enum") { MissingField.entries.forEach { add(it.wire) } }
            }
            put("uniqueItems", true)
            put("maxItems", MissingField.entries.size)
        }
        putJsonObject(GameFilters.RATED_FIELD) {
            put("type", "boolean")
            put(
                "description",
                "true: only games that already have a rating. false or omitted: no filter on rating.",
            )
        }
        putJsonObject(GameSort.FIELD) {
            put("type", "string")
            putJsonArray("enum") { GameSort.entries.forEach { add(it.wire) } }
            put(
                "description",
                "How to order the matches. title (default): alphabetically. release_asc/release_desc: by " +
                    "release date (falling back to releaseYear), oldest/newest first. rating_desc: by rating, " +
                    "highest first.",
            )
        }
        putJsonObject(PageSize.FIELD) {
            put("type", "integer")
            put(
                "description",
                "How many games to return at most. Defaults to 10, $SEARCH_GAMES_MAX_SIZE at most.",
            )
            put("minimum", 1)
            put("maximum", SEARCH_GAMES_MAX_SIZE)
            put("default", SEARCH_GAMES_DEFAULT_SIZE.value)
        }
    },
    required = emptyList(),
)

// Mirrors the constraints value classes enforce in games/domain/GameValues.kt.
private val UPDATE_GAME_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("id") {
            put("type", "string")
            put("format", "uuid")
            put("description", "The game's id, as returned by search_games.")
        }
        putJsonObject("title") {
            put("type", "string")
            put("description", "The game's title.")
            put("minLength", 1)
            put("maxLength", 256)
        }
        putJsonObject("releaseYear") {
            put("type", "integer")
            put(
                "description",
                "The four-digit release year. On a game that already has a releaseDate (and this call does " +
                    "not clear it), that date's year is kept and overrides this value instead; set releaseDate " +
                    "to change the year of a game that has one.",
            )
            put("minimum", 1000)
            put("maximum", 9999)
        }
        putJsonObject("platformIds") {
            put("type", "array")
            put(
                "description",
                "Ids of the platforms this game was released on, from list_game_platforms. Replaces the " +
                    "full list. At least one is required.",
            )
            putJsonObject("items") {
                put("type", "string")
                put("format", "uuid")
            }
            put("minItems", 1)
            put("uniqueItems", true)
        }
        putJsonObject("description") {
            putJsonArray("type") {
                add("string")
                add("null")
            }
            put("description", "Free-form notes about the game, at most 10000 characters. null clears it.")
            put("minLength", 1)
            put("maxLength", 10000)
        }
        putJsonObject("rating") {
            putJsonArray("type") {
                add("number")
                add("null")
            }
            put("description", "A star rating between 0.25 and 5.0, in quarter-star steps. null clears it.")
            put("minimum", 0.25)
            put("maximum", 5.0)
            put("multipleOf", 0.25)
        }
        putJsonObject("coverImageUrl") {
            putJsonArray("type") {
                add("string")
                add("null")
            }
            put("description", "An absolute http(s) URL to a cover image. null clears it.")
            put("minLength", 1)
            put("maxLength", 2048)
            put("format", "uri")
        }
        putJsonObject("ownership") {
            put("type", "string")
            putJsonArray("enum") { Ownership.entries.forEach { add(it.wire) } }
            put(
                "description",
                "Whether the game is owned, available through a subscription (e.g. PlayStation Plus, Game Pass), " +
                    "or just on the watchlist. Cannot be cleared.",
            )
        }
        putJsonObject("progress") {
            put("type", "string")
            putJsonArray("enum") { Progress.entries.forEach { add(it.wire) } }
            put(
                "description",
                "How far the game has been played. completed means fully finished (100%). Cannot be cleared.",
            )
        }
        putJsonObject("hidden") {
            put("type", "boolean")
            put("description", "Whether the game is hidden from the default list view. Cannot be cleared.")
        }
        putJsonObject("releaseDate") {
            putJsonArray("type") {
                add("string")
                add("null")
            }
            put("format", "date")
            put(
                "description",
                "The game's precise release date (YYYY-MM-DD); its year overrides releaseYear. null clears " +
                    "the date and keeps the game's current releaseYear.",
            )
        }
        putJsonObject("developerIds") {
            put("type", "array")
            put(
                "description",
                "Ids of the developers who made this game, from search_game_developers (create missing ones " +
                    "with create_game_developer). Replaces the full list; an empty array clears it.",
            )
            putJsonObject("items") {
                put("type", "string")
                put("format", "uuid")
            }
            put("uniqueItems", true)
        }
    },
    required = listOf("id"),
)

private val LIST_EXPANSIONS_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("gameId") {
            put("type", "string")
            put("format", "uuid")
            put("description", "The game's id, as returned by search_games.")
        }
    },
    required = listOf("gameId"),
)

// Mirrors the constraints value classes enforce in games/domain/Expansion.kt / games/domain/GameValues.kt.
private val ADD_EXPANSION_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("gameId") {
            put("type", "string")
            put("format", "uuid")
            put("description", "The game's id, as returned by search_games.")
        }
        putJsonObject("title") {
            put("type", "string")
            put("description", "The expansion's title.")
            put("minLength", 1)
            put("maxLength", 256)
        }
        putJsonObject("ownership") {
            put("type", "string")
            putJsonArray("enum") { Ownership.entries.forEach { add(it.wire) } }
            put(
                "description",
                "Whether the expansion is owned, available through a subscription, or just on the watchlist. " +
                    "Defaults to watchlist.",
            )
        }
        putJsonObject("progress") {
            put("type", "string")
            putJsonArray("enum") { Progress.entries.forEach { add(it.wire) } }
            put(
                "description",
                "How far the expansion has been played. completed means fully finished (100%). " +
                    "Defaults to not_started.",
            )
        }
    },
    required = listOf("gameId", "title"),
)

// Mirrors the constraints SearchTerm and ReleaseYear enforce; find_game_cover has no request DTO of its own.
private val FIND_GAME_COVER_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("title") {
            put("type", "string")
            put("description", "The game's full official title.")
            put("minLength", 1)
            put("maxLength", SearchTerm.MAX_LENGTH)
        }
        putJsonObject("releaseYear") {
            put("type", "integer")
            put("description", "The four-digit release year; improves ranking when several titles are similar.")
            put("minimum", ReleaseYear.MIN)
            put("maximum", ReleaseYear.MAX)
        }
    },
    required = listOf("title"),
)

private const val SEARCH_GAME_DEVELOPERS_DESCRIPTION =
    "Searches the developer vocabulary (the studios/publishers add_game and update_game's developerIds refer " +
        "to) by name prefix, best match first (so even a short name like \"EA\" is found by its own prefix) - " +
        "at most pageSize matches, 10 by default. Leave query empty (or blank) to list every known developer " +
        "alphabetically instead of searching. Returns each match's name and the id developerIds expects; when " +
        "the developer you need is not found, create it first with " +
        "create_game_developer."

private const val CREATE_GAME_DEVELOPER_DESCRIPTION =
    "Adds a developer to the vocabulary and returns its id for use in developerIds. Idempotent: when a " +
        "developer with the same name already exists (case-insensitively), that existing developer is " +
        "returned instead of a duplicate - created is false then. Call search_game_developers first to check " +
        "whether the developer is already tracked before creating a new one."

// Mirrors the constraint DeveloperSearchLimit enforces; search_game_developers has no request DTO of its own.
private val SEARCH_GAME_DEVELOPERS_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("query") {
            put("type", "string")
            put("description", "Name prefix to search for. Leave empty to list every developer alphabetically.")
            put("maxLength", SearchTerm.MAX_LENGTH)
        }
        putJsonObject("pageSize") {
            put("type", "integer")
            put(
                "description",
                "How many developers to return at most. Defaults to 10, ${DeveloperSearchLimit.MAX} at most.",
            )
            put("minimum", 1)
            put("maximum", DeveloperSearchLimit.MAX)
            put("default", DeveloperSearchLimit.DEFAULT.value)
        }
    },
    required = emptyList(),
)

// Mirrors the constraints DeveloperName enforces in games/domain/GameValues.kt.
private val CREATE_GAME_DEVELOPER_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("name") {
            put("type", "string")
            put("description", "The developer's name.")
            put("minLength", 1)
            put("maxLength", DeveloperName.MAX_LENGTH)
        }
    },
    required = listOf("name"),
)

// McpJson has ignoreUnknownKeys = true and isLenient = true, which would turn a typo'd field name into a silent
// no-op instead of an error; validate the key set by hand instead. The accepted names are derived from
// UpdateGameRequest's serial descriptor, so they cannot drift from the DTO.
@OptIn(ExperimentalSerializationApi::class)
private val UPDATE_GAME_FIELDS: Set<String> = UpdateGameRequest.serializer().descriptor.elementNames.toSet()

// Same reasoning as UPDATE_GAME_FIELDS, plus the gameId argument the create request DTO does not carry.
@OptIn(ExperimentalSerializationApi::class)
private val ADD_EXPANSION_FIELDS: Set<String> =
    CreateExpansionRequest.serializer().descriptor.elementNames.toSet() + "gameId"

// Same reasoning as SEARCH_GAMES_FIELDS: list_expansions has no request DTO of its own, so the accepted names
// are derived from LIST_EXPANSIONS_SCHEMA's own property keys.
private val LIST_EXPANSIONS_FIELDS: Set<String> = LIST_EXPANSIONS_SCHEMA.properties!!.keys

// Same reasoning as UPDATE_GAME_FIELDS: search_games has no request DTO (its arguments are read by hand into a
// GameFilters), so the accepted names are derived from SEARCH_GAMES_SCHEMA's own property keys instead, which
// keeps the guard from drifting from the schema an agent actually sees.
private val SEARCH_GAMES_FIELDS: Set<String> = SEARCH_GAMES_SCHEMA.properties!!.keys

// Same reasoning as SEARCH_GAMES_FIELDS: find_game_cover has no request DTO, so the accepted names are derived
// from FIND_GAME_COVER_SCHEMA's own property keys.
private val FIND_GAME_COVER_FIELDS: Set<String> = FIND_GAME_COVER_SCHEMA.properties!!.keys

// Same reasoning as FIND_GAME_COVER_FIELDS: search_game_developers has no request DTO, so the accepted names
// are derived from SEARCH_GAME_DEVELOPERS_SCHEMA's own property keys.
private val SEARCH_GAME_DEVELOPERS_FIELDS: Set<String> = SEARCH_GAME_DEVELOPERS_SCHEMA.properties!!.keys

// Same reasoning as ADD_EXPANSION_FIELDS: the accepted names are derived from CreateGameDeveloperRequest's
// serial descriptor, so they cannot drift from the DTO.
@OptIn(ExperimentalSerializationApi::class)
private val CREATE_GAME_DEVELOPER_FIELDS: Set<String> =
    CreateGameDeveloperRequest.serializer().descriptor.elementNames.toSet()

// The PatchField-backed fields are the only ones that accept null to clear themselves; every other field on
// UpdateGameRequest is a plain nullable type where null would silently mean "unchanged" instead of "clear", so
// it is derived as everything else rather than hand-listed - a new plain nullable field is unclearable by
// default without touching this set.
private val UPDATE_GAME_CLEARABLE = setOf("description", "rating", "coverImageUrl", "releaseDate")
private val UPDATE_GAME_UNCLEARABLE = UPDATE_GAME_FIELDS - UPDATE_GAME_CLEARABLE

// Prose fragment for a game's year, precise date and known developers, used in add_game/update_game/
// search_games text output; ids are structured content only, following how list_game_platforms keeps ids out
// of its own text line.
private fun GameResponse.yearAndDevelopers(): String {
    val date = releaseDate?.let { ", $it" } ?: ""
    val developerNames = if (developers.isEmpty()) "" else " by ${developers.joinToString(", ") { it.name }}"
    return "$releaseYear$date$developerNames"
}

// Names the ordering search_games' text summary claims, matching what GameSort's own description says it does.
private fun GameSort.orderingWord(): String = when (this) {
    GameSort.TITLE -> "best first"
    GameSort.RELEASE_ASC -> "oldest release first"
    GameSort.RELEASE_DESC -> "newest release first"
    GameSort.RATING_DESC -> "highest rated first"
}

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
                        "Created game \"${response.title}\" (${response.yearAndDevelopers()}) with id " +
                            "${response.id}.",
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
            val arguments = request.arguments ?: JsonObject(emptyMap())
            // McpJson ignores unknown keys, which would turn a typo'd filter name (or the singular REST spelling)
            // into a silently unfiltered search instead of an error; reject it here instead, as update_game does.
            val unknown = arguments.keys - SEARCH_GAMES_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            val term = SearchTerm.parseOrNull(arguments.stringOrNull("query"), field = "query")
            val filters = GameFilters(
                platformIds = arguments.stringArrayOrNull("platformIds")
                    ?.map(GamePlatformId::parse)?.toSet() ?: emptySet(),
                ownership = arguments.stringArrayOrNull("ownership")?.map(Ownership::from)?.toSet() ?: emptySet(),
                progress = arguments.stringArrayOrNull("progress")?.map(Progress::from)?.toSet() ?: emptySet(),
                releaseYears = arguments.intArrayOrNull("releaseYears")
                    ?.map(::ReleaseYear)?.toSet() ?: emptySet(),
                missing = arguments.stringArrayOrNull(MissingField.FIELD)
                    ?.map(MissingField::from)?.toSet() ?: emptySet(),
                ratedOnly = arguments.booleanOrNull(GameFilters.RATED_FIELD) ?: false,
            )
            requireValid("query", term != null || !filters.isEmpty) { "provide a query or at least one filter" }
            val size = arguments.intOrNull(PageSize.FIELD)?.let { requested ->
                requireValid(PageSize.FIELD, requested in 1..SEARCH_GAMES_MAX_SIZE) {
                    "must be between 1 and $SEARCH_GAMES_MAX_SIZE"
                }
                PageSize(requested)
            } ?: SEARCH_GAMES_DEFAULT_SIZE
            val sort = arguments.stringOrNull(GameSort.FIELD)?.let(GameSort::from) ?: GameSort.DEFAULT
            val page = gameService.list(PageRequest(PageNumber.FIRST, size), term, filters, sort)
            val games = page.items.map { it.toResponse() }
            // Both a query and filters may be absent from the summary text: describe whichever was given.
            val subject = term?.let { "\"$it\"" } ?: "the given filters"
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (games.isEmpty()) {
                            "No games match $subject."
                        } else {
                            // The tool returns at most pageSize matches without paging: say how many matches exist
                            // so a truncated list is recognisable.
                            "${games.size} of ${page.totalItems} matches for $subject, ${sort.orderingWord()}:\n" +
                                games.joinToString("\n") { "${it.title} (${it.yearAndDevelopers()}): ${it.id}" }
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    put("totalMatches", page.totalItems)
                    put("truncated", page.totalItems > games.size)
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

private fun Server.addUpdateGameTool(gameService: GameService) {
    addTool(
        name = "update_game",
        description = UPDATE_GAME_DESCRIPTION,
        inputSchema = UPDATE_GAME_SCHEMA,
        toolAnnotations = ToolAnnotations(idempotentHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            val id = GameId.parse(arguments.stringOrNull("id") ?: throw InvalidValueException("id", "is missing"))
            val fields = JsonObject(arguments - "id")
            // McpJson ignores unknown keys, which would turn a typo into a silent no-op; reject it here instead.
            val unknown = fields.keys - UPDATE_GAME_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            requireValid("arguments", fields.isNotEmpty()) { "must change at least one field" }
            UPDATE_GAME_UNCLEARABLE.forEach { field ->
                requireValid(field, fields[field] !is JsonNull) { "cannot be cleared" }
            }
            val patch = McpJson.decodeFromJsonElement(UpdateGameRequest.serializer(), fields).toPatch()
            val game = gameService.update(id, patch).toResponse()
            CallToolResult(
                content = listOf(
                    TextContent(
                        "Updated ${fields.keys.sorted().joinToString()} of \"${game.title}\" " +
                            "(${game.yearAndDevelopers()}).",
                    ),
                ),
                structuredContent = McpJson.encodeToJsonElement(GameResponse.serializer(), game).jsonObject,
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

private fun Server.addListExpansionsTool(expansionService: ExpansionService) {
    addTool(
        name = "list_expansions",
        description = LIST_EXPANSIONS_DESCRIPTION,
        inputSchema = LIST_EXPANSIONS_SCHEMA,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            val unknown = arguments.keys - LIST_EXPANSIONS_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            val gameId = GameId.parse(
                arguments.stringOrNull("gameId") ?: throw InvalidValueException("gameId", "is missing"),
            )
            val expansions = expansionService.list(gameId).map { it.toResponse() }
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (expansions.isEmpty()) {
                            "This game has no expansions."
                        } else {
                            "${expansions.size} expansion(s), in order:\n" +
                                expansions.joinToString("\n") {
                                    "${it.title} (${it.ownership}/${it.progress}): ${it.id}"
                                }
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    put("count", expansions.size)
                    putJsonArray("expansions") {
                        expansions.forEach { add(McpJson.encodeToJsonElement(ExpansionResponse.serializer(), it)) }
                    }
                },
            )
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        } catch (e: NotFoundException) {
            e.toErrorResult()
        }
    }
}

private fun Server.addAddExpansionTool(expansionService: ExpansionService) {
    addTool(
        name = "add_expansion",
        description = ADD_EXPANSION_DESCRIPTION,
        inputSchema = ADD_EXPANSION_SCHEMA,
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            // McpJson ignores unknown keys, which would turn a typo'd field name into a silent no-op instead of
            // an error; reject it here instead, as update_game does.
            val unknown = arguments.keys - ADD_EXPANSION_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            val gameId = GameId.parse(
                arguments.stringOrNull("gameId") ?: throw InvalidValueException("gameId", "is missing"),
            )
            val createRequest = McpJson.decodeFromJsonElement(
                CreateExpansionRequest.serializer(),
                JsonObject(arguments - "gameId"),
            )
            val expansion = expansionService.create(gameId, createRequest.toNewExpansion()).toResponse()
            CallToolResult(
                content = listOf(
                    TextContent(
                        "Added expansion \"${expansion.title}\" to game $gameId with id ${expansion.id}.",
                    ),
                ),
                structuredContent =
                McpJson.encodeToJsonElement(ExpansionResponse.serializer(), expansion).jsonObject,
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

private fun Server.addSearchGameDevelopersTool(developerService: GameDeveloperService) {
    addTool(
        name = "search_game_developers",
        description = SEARCH_GAME_DEVELOPERS_DESCRIPTION,
        inputSchema = SEARCH_GAME_DEVELOPERS_SCHEMA,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            val unknown = arguments.keys - SEARCH_GAME_DEVELOPERS_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            val term = SearchTerm.parseOrNull(arguments.stringOrNull("query"), field = "query")
            val limit = arguments.intOrNull("pageSize")?.let { requested ->
                requireValid("pageSize", requested in 1..DeveloperSearchLimit.MAX) {
                    "must be between 1 and ${DeveloperSearchLimit.MAX}"
                }
                DeveloperSearchLimit(requested)
            } ?: DeveloperSearchLimit.DEFAULT
            val developers = developerService.search(term, limit).map { it.toResponse() }
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (developers.isEmpty()) {
                            "No developers found."
                        } else {
                            developers.joinToString("\n") { "${it.name}: ${it.id}" }
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    putJsonArray("developers") {
                        developers.forEach { developer ->
                            addJsonObject {
                                put("id", developer.id)
                                put("name", developer.name)
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

private fun Server.addCreateGameDeveloperTool(developerService: GameDeveloperService) {
    addTool(
        name = "create_game_developer",
        description = CREATE_GAME_DEVELOPER_DESCRIPTION,
        inputSchema = CREATE_GAME_DEVELOPER_SCHEMA,
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            val unknown = arguments.keys - CREATE_GAME_DEVELOPER_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            val createRequest = McpJson.decodeFromJsonElement(CreateGameDeveloperRequest.serializer(), arguments)
            val result = developerService.create(DeveloperName.parse(createRequest.name))
            val response = result.developer.toResponse()
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (result.created) {
                            "Created developer \"${response.name}\" with id ${response.id}."
                        } else {
                            "Developer \"${response.name}\" already exists with id ${response.id}."
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

private fun Server.addFindGameCoverTool(coverOptionsService: CoverOptionsService) {
    addTool(
        name = "find_game_cover",
        description = FIND_GAME_COVER_DESCRIPTION,
        inputSchema = FIND_GAME_COVER_SCHEMA,
        toolAnnotations = ToolAnnotations(readOnlyHint = true, openWorldHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            val unknown = arguments.keys - FIND_GAME_COVER_FIELDS
            requireValid("arguments", unknown.isEmpty()) { "unknown fields: ${unknown.sorted().joinToString()}" }
            val title = SearchTerm.parseOrNull(arguments.stringOrNull("title"), field = "title")
                ?: throw InvalidValueException("title", "is missing")
            val releaseYear = arguments.intOrNull("releaseYear")?.let(::ReleaseYear)
            val lookup = coverOptionsService.findFirstCover(title, releaseYear)
            if (lookup == null) {
                CallToolResult(
                    content = listOf(TextContent("No cover found for \"$title\".")),
                    structuredContent = buildJsonObject { put("found", false) },
                )
            } else {
                val match = lookup.match.toResponse()
                val year = match.releaseYear?.toString() ?: "year unknown"
                val verified = if (match.verified) "verified" else "unverified"
                CallToolResult(
                    content = listOf(
                        TextContent(
                            "Cover for \"${match.name}\" ($year, $verified): ${lookup.cover.imageUrl.value}",
                        ),
                    ),
                    structuredContent = buildJsonObject {
                        put("found", true)
                        put("imageUrl", lookup.cover.imageUrl.value)
                        put("width", lookup.cover.width)
                        put("height", lookup.cover.height)
                        put("match", McpJson.encodeToJsonElement(CoverMatchResponse.serializer(), match))
                    },
                )
            }
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        } catch (e: ExternalSourceException) {
            // Mirrors StatusPages' ExternalSourceException handling: log the real failure at warn, but never
            // echo it (e.message may carry upstream detail meant for logs, not clients) - a fixed, generic
            // message instead.
            log.warn("External source '${e.source}' call failed", e)
            CallToolResult(
                content = listOf(TextContent("${e.source} is currently unavailable")),
                isError = true,
            )
        }
    }
}

private fun JsonObject.stringOrNull(field: String): String? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonPrimitive -> argument.takeIf { it.isString }?.content
        ?: throw InvalidValueException(field, "must be a string")

    else -> throw InvalidValueException(field, "must be a string")
}

private fun JsonObject.stringArrayOrNull(field: String): List<String>? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonArray -> argument.map { element ->
        (element as? JsonPrimitive)?.takeIf { it.isString }?.content
            ?: throw InvalidValueException(field, "must be an array of strings")
    }

    else -> throw InvalidValueException(field, "must be an array of strings")
}

private fun JsonObject.intArrayOrNull(field: String): List<Int>? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonArray -> argument.map { element ->
        (element as? JsonPrimitive)?.intOrNull
            ?: throw InvalidValueException(field, "must be an array of integers")
    }

    else -> throw InvalidValueException(field, "must be an array of integers")
}

private fun JsonObject.intOrNull(field: String): Int? = when (val argument = this[field]) {
    null, is JsonNull -> null
    is JsonPrimitive -> argument.intOrNull ?: throw InvalidValueException(field, "must be an integer")
    else -> throw InvalidValueException(field, "must be an integer")
}

private fun JsonObject.booleanOrNull(field: String): Boolean? = when (val argument = this[field]) {
    null, is JsonNull -> null

    is JsonPrimitive -> argument.takeIf { !it.isString }?.booleanOrNull
        ?: throw InvalidValueException(field, "must be a boolean")

    else -> throw InvalidValueException(field, "must be a boolean")
}

private fun Exception.toErrorResult(): CallToolResult =
    CallToolResult(content = listOf(TextContent(message ?: "invalid request")), isError = true)
