package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorService
import de.sluit.mediatracker.books.domain.BookCoverOptionsService
import de.sluit.mediatracker.books.domain.BookCoverSourceKind
import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookMissingField
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookNarratorService
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesPosition
import de.sluit.mediatracker.books.domain.BookSeriesService
import de.sluit.mediatracker.books.domain.BookService
import de.sluit.mediatracker.books.domain.BookSort
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.common.api.MAX_FILTER_VALUES
import de.sluit.mediatracker.common.api.VocabularyEntryView
import de.sluit.mediatracker.common.api.addCreateVocabularyTool
import de.sluit.mediatracker.common.api.addSearchVocabularyTool
import de.sluit.mediatracker.common.api.intArrayOrNull
import de.sluit.mediatracker.common.api.intOrNull
import de.sluit.mediatracker.common.api.putCoverImageUrlProperty
import de.sluit.mediatracker.common.api.putDescriptionProperty
import de.sluit.mediatracker.common.api.putEnumArrayProperty
import de.sluit.mediatracker.common.api.putEnumProperty
import de.sluit.mediatracker.common.api.putPageSizeProperty
import de.sluit.mediatracker.common.api.putQueryProperty
import de.sluit.mediatracker.common.api.putReleaseDateProperty
import de.sluit.mediatracker.common.api.putReleaseYearProperty
import de.sluit.mediatracker.common.api.putReleaseYearsFilterProperty
import de.sluit.mediatracker.common.api.putTitleProperty
import de.sluit.mediatracker.common.api.putUuidArrayProperty
import de.sluit.mediatracker.common.api.requireKnownFields
import de.sluit.mediatracker.common.api.requireNotCleared
import de.sluit.mediatracker.common.api.sizeOrNull
import de.sluit.mediatracker.common.api.stringArrayOrNull
import de.sluit.mediatracker.common.api.stringOrNull
import de.sluit.mediatracker.common.api.toErrorResult
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.domain.requireValid
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import org.slf4j.LoggerFactory
import java.math.BigDecimal

/**
 * Registers the MCP tools the books feature offers on [server]: [de.sluit.mediatracker.mcpRoutes] calls this once
 * per request, exactly as [bookRoutes] contributes the REST routes. There is no delete tool, as for games.
 */
fun Server.addBookTools(
    bookService: BookService,
    bookAuthorService: BookAuthorService,
    bookNarratorService: BookNarratorService,
    bookSeriesService: BookSeriesService,
    bookCoverOptionsService: BookCoverOptionsService,
) {
    addListBookTypesTool(bookService)
    addAddBookTool(bookService)
    addSearchBooksTool(bookService)
    addUpdateBookTool(bookService)
    addSearchBookAuthorsTool(bookAuthorService)
    addCreateBookAuthorTool(bookAuthorService)
    addSearchBookNarratorsTool(bookNarratorService)
    addCreateBookNarratorTool(bookNarratorService)
    addSearchBookSeriesTool(bookSeriesService)
    addCreateBookSeriesTool(bookSeriesService)
    addFindBookCoverTool(bookCoverOptionsService)
}

// No enclosing class to hang a member logger off, unlike e.g. auth/domain/ApiKeyService.
private val log = LoggerFactory.getLogger("de.sluit.mediatracker.books.api.BookMcpTools")

private const val LIST_BOOK_TYPES_DESCRIPTION =
    "Lists the book types this tracker knows (hardcover, paperback, Kindle, ...), with the ids add_book and " +
        "update_book expect in typeIds. Types are optional: a book may have none."

private const val ADD_BOOK_DESCRIPTION =
    "Adds a book to the tracker. title is required; releaseYear is required unless releaseDate is given, in " +
        "which case the date's year is used instead (and overrides a releaseYear that contradicts it), so " +
        "releaseYear may then be omitted. description and coverImageUrl are optional. authorIds are optional " +
        "book_authors.id values; call search_book_authors first to look them up, and create_book_author for " +
        "any author that search does not find, then pass the ids here. narratorIds work the same way with " +
        "search_book_narrators and create_book_narrator. series is an optional array of {seriesId, position}: " +
        "seriesId is a book_series.id from search_book_series (create missing ones with create_book_series), " +
        "position is the book's optional number in that series (0 to 9999.99, at most two decimals, e.g. 1 or " +
        "2.5), each series at most once. typeIds are optional book_types.id " +
        "values from list_book_types; a book does not need a type. ownership and progress are also optional: " +
        "ownership defaults to watchlist, progress defaults to not_started."

private const val SEARCH_BOOKS_DESCRIPTION =
    "Searches the tracked books by title and returns the best matches - at most pageSize of them, 10 by " +
        "default. A title matches when any query word is a prefix of a title word or when the title starts " +
        "with the whole query; titles that start with the query come first, then best match first. Any word " +
        "may match; each word is treated as a prefix (\"harr\" finds \"Harry Potter\"). typeIds, ownership, " +
        "progress and releaseYears narrow the search: several values inside one filter mean \"any of\" (e.g. " +
        "progress: [\"reading\",\"paused\"] matches either), but every filter that is given has to match. " +
        "typeIds are book_types.id values; call list_book_types first to get them. hasMissing finds books " +
        "whose description or cover image is still empty, so they can be filled in with update_book. sort " +
        "orders the matches: title (default) alphabetically, release_asc/release_desc by release date (oldest/" +
        "newest first). At least one of query or a filter is required (sort alone does not count as one). " +
        "Each match carries the id update_book needs to change it. pageSize controls how many matches come back, " +
        "10 by default and 100 at most."

private const val UPDATE_BOOK_DESCRIPTION =
    "Updates a book that is already tracked. id is the book's id as returned by search_books - never guess or " +
        "invent one; users refer to books by title, so look the book up with search_books first. If the " +
        "search returns more than one plausible match, ask the user which one they mean and update nothing " +
        "until they answer. Pass only the fields that should change; every field you omit keeps its current " +
        "value. description, coverImageUrl and releaseDate accept null to clear the field (clearing " +
        "releaseDate keeps the book's current releaseYear, it does not clear it too); title, releaseYear, " +
        "typeIds, authorIds, ownership and progress cannot be cleared. typeIds, when given, replaces the " +
        "whole type list (ids from list_book_types), it does not add to it. authorIds, when given, replaces " +
        "the whole author list (ids from search_book_authors; create missing ones with create_book_author " +
        "first). narratorIds, when given, replaces the whole narrator list (ids from search_book_narrators; " +
        "create missing ones with create_book_narrator first). series, when given, replaces the whole series " +
        "list: an array of {seriesId, position} (ids from search_book_series; create missing ones with " +
        "create_book_series first; position is optional, 0 to 9999.99 with at most two decimals, each series " +
        "at most once). An empty array clears typeIds, authorIds, narratorIds or series, it does not need " +
        "null. Passing nothing but id, or a field name that is not in the schema, is an error."

private const val SEARCH_BOOK_AUTHORS_DESCRIPTION =
    "Searches the author vocabulary (the authors add_book and update_book's authorIds refer to) by name " +
        "prefix, best match first - at most pageSize matches, 10 by default. Leave query empty (or blank) to " +
        "list every known author alphabetically instead of searching. Returns each match's name and the id " +
        "authorIds expects; when the author you need is not found, create it first with create_book_author."

private const val CREATE_BOOK_AUTHOR_DESCRIPTION =
    "Adds an author to the vocabulary and returns its id for use in authorIds. Idempotent: when an author " +
        "with the same name already exists (case-insensitively), that existing author is returned instead of " +
        "a duplicate - created is false then. Call search_book_authors first to check whether the author is " +
        "already tracked before creating a new one."

private const val SEARCH_BOOK_NARRATORS_DESCRIPTION =
    "Searches the narrator vocabulary (the narrators add_book and update_book's narratorIds refer to) by name " +
        "prefix, best match first - at most pageSize matches, 10 by default. Leave query empty (or blank) to " +
        "list every known narrator alphabetically instead of searching. Returns each match's name and the id " +
        "narratorIds expects; when the narrator you need is not found, create it first with create_book_narrator."

private const val CREATE_BOOK_NARRATOR_DESCRIPTION =
    "Adds a narrator to the vocabulary and returns its id for use in narratorIds. Idempotent: when a narrator " +
        "with the same name already exists (case-insensitively), that existing narrator is returned instead of " +
        "a duplicate - created is false then. Call search_book_narrators first to check whether the narrator " +
        "is already tracked before creating a new one."

private const val SEARCH_BOOK_SERIES_DESCRIPTION =
    "Searches the series vocabulary (the series add_book and update_book's series refer to) by name prefix, " +
        "best match first - at most pageSize matches, 10 by default. Leave query empty (or blank) to list every " +
        "known series alphabetically instead of searching. Returns each match's name and the id seriesId " +
        "expects; when the series you need is not found, create it first with create_book_series."

private const val CREATE_BOOK_SERIES_DESCRIPTION =
    "Adds a series to the vocabulary and returns its id for use as seriesId. Idempotent: when a series with " +
        "the same name already exists (case-insensitively), that existing series is returned instead of a " +
        "duplicate - created is false then. Call search_book_series first to check whether the series is " +
        "already tracked before creating a new one."

/** What `search_books` returns when the caller names no `pageSize`; its ceiling is [SEARCH_BOOKS_MAX_SIZE]. */
private val SEARCH_BOOKS_DEFAULT_SIZE = PageSize(10)

/** The tool's own cap, deliberately below `PageSize`'s 200: a tool result is prose in someone's context window. */
private const val SEARCH_BOOKS_MAX_SIZE = 100

// Mirrors the constraints value classes enforce in common/domain/MediaValues.kt and books/domain/BookValues.kt.
private val ADD_BOOK_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putTitleProperty("The book's title.")
        putReleaseYearProperty(
            "The four-digit release year. Required unless releaseDate is given, whose year then wins.",
        )
        putReleaseDateProperty(
            "The book's precise release date (YYYY-MM-DD). Optional; when given, its year overrides " +
                "releaseYear, which then may be omitted.",
        )
        putDescriptionProperty("Free-form notes about the book, at most 10000 characters.")
        putCoverImageUrlProperty("An absolute http(s) URL to a cover image.")
        putEnumProperty(
            BookOwnership.FIELD,
            BookOwnership.entries,
            "Whether the book is owned or just on the watchlist. Defaults to watchlist.",
        )
        putEnumProperty(
            BookProgress.FIELD,
            BookProgress.entries,
            "How far the book has been read. Defaults to not_started.",
        )
        putUuidArrayProperty(
            BookTypeId.FIELD,
            "Ids of the types this book comes in, from list_book_types. Optional; a book may have none.",
        )
        putUuidArrayProperty(
            BookAuthorId.FIELD,
            "Ids of the authors who wrote this book, from search_book_authors (create missing ones with " +
                "create_book_author). Optional.",
        )
        putUuidArrayProperty(
            BookNarratorId.FIELD,
            "Ids of the narrators of this book, from search_book_narrators (create missing ones with " +
                "create_book_narrator). Optional.",
        )
        putSeriesLinksProperty(
            "The series this book belongs to, each with the book's optional number in it. seriesId comes " +
                "from search_book_series (create missing ones with create_book_series). Optional.",
        )
    },
    required = listOf("title"),
)

// Mirrors BookFilters; the enum arrays are built from the domain entries so the schema cannot drift from it.
private val SEARCH_BOOKS_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putQueryProperty("Words to search for.")
        putUuidArrayProperty(
            BookTypeId.FIELD,
            "Only books of one of these types, ids from list_book_types.",
            maxItems = MAX_FILTER_VALUES,
        )
        putEnumArrayProperty(
            BookOwnership.FIELD,
            BookOwnership.entries,
            "Only books whose ownership is one of these values.",
        )
        putEnumArrayProperty(
            BookProgress.FIELD,
            BookProgress.entries,
            "Only books whose progress is one of these values.",
        )
        putReleaseYearsFilterProperty("Only books released in one of these years.")
        putEnumArrayProperty(
            BookMissingField.FIELD,
            BookMissingField.entries,
            "Only books where at least one of these properties has no value yet. Use it to find books " +
                "with incomplete data.",
            maxItems = BookMissingField.entries.size,
        )
        putEnumProperty(
            BookSort.FIELD,
            BookSort.entries,
            "How to order the matches. title (default): alphabetically. release_asc/release_desc: by " +
                "release date (falling back to releaseYear), oldest/newest first.",
        )
        putPageSizeProperty(
            "How many books to return at most. Defaults to 10, $SEARCH_BOOKS_MAX_SIZE at most.",
            max = SEARCH_BOOKS_MAX_SIZE,
            default = SEARCH_BOOKS_DEFAULT_SIZE.value,
        )
    },
    required = emptyList(),
)

// Mirrors the constraints value classes enforce in common/domain/MediaValues.kt and books/domain/BookValues.kt.
private val UPDATE_BOOK_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("id") {
            put("type", "string")
            put("format", "uuid")
            put("description", "The book's id, as returned by search_books.")
        }
        putTitleProperty("The book's title.")
        putReleaseYearProperty(
            "The four-digit release year. On a book that already has a releaseDate (and this call does " +
                "not clear it), that date's year is kept and overrides this value instead; set releaseDate " +
                "to change the year of a book that has one.",
        )
        putDescriptionProperty(
            "Free-form notes about the book, at most 10000 characters. null clears it.",
            clearable = true,
        )
        putCoverImageUrlProperty("An absolute http(s) URL to a cover image. null clears it.", clearable = true)
        putEnumProperty(
            BookOwnership.FIELD,
            BookOwnership.entries,
            "Whether the book is owned or just on the watchlist. Cannot be cleared.",
        )
        putEnumProperty(
            BookProgress.FIELD,
            BookProgress.entries,
            "How far the book has been read. Cannot be cleared.",
        )
        putReleaseDateProperty(
            "The book's precise release date (YYYY-MM-DD); its year overrides releaseYear. null clears " +
                "the date and keeps the book's current releaseYear.",
            clearable = true,
        )
        putUuidArrayProperty(
            BookTypeId.FIELD,
            "Ids of the types this book comes in, from list_book_types. Replaces the full list; an empty " +
                "array clears it.",
        )
        putUuidArrayProperty(
            BookAuthorId.FIELD,
            "Ids of the authors who wrote this book, from search_book_authors (create missing ones with " +
                "create_book_author). Replaces the full list; an empty array clears it.",
        )
        putUuidArrayProperty(
            BookNarratorId.FIELD,
            "Ids of the narrators of this book, from search_book_narrators (create missing ones with " +
                "create_book_narrator). Replaces the full list; an empty array clears it.",
        )
        putSeriesLinksProperty(
            "The series this book belongs to, each with the book's optional number in it. seriesId comes " +
                "from search_book_series (create missing ones with create_book_series). Replaces the full " +
                "list; an empty array clears it.",
        )
    },
    required = listOf("id"),
)

// An array of {seriesId, position?}; mirrors BookSeriesLinkRequest and the rules of BookSeriesPosition.
private fun JsonObjectBuilder.putSeriesLinksProperty(description: String) {
    putJsonObject(BookSeriesId.FIELD) {
        put("type", "array")
        put("description", description)
        putJsonObject("items") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("seriesId") {
                    put("type", "string")
                    put("format", "uuid")
                }
                putJsonObject("position") {
                    put("type", "number")
                    put("minimum", 0)
                    put("maximum", BookSeriesPosition.MAX_VALUE.toDouble())
                    put(
                        "description",
                        "The book's number in the series, e.g. 1 or 2.5, with at most two decimal places. Optional.",
                    )
                }
            }
            putJsonArray("required") { add("seriesId") }
            put("additionalProperties", false)
        }
    }
}

// Mirrors the constraint VocabularySearchLimit enforces; search_book_authors has no request DTO of its own.
private val SEARCH_BOOK_AUTHORS_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putQueryProperty(
            "Name prefix to search for. Leave empty to list every author alphabetically.",
            minLength = null,
        )
        putPageSizeProperty(
            "How many authors to return at most. Defaults to 10, ${VocabularySearchLimit.MAX} at most.",
            max = VocabularySearchLimit.MAX,
            default = VocabularySearchLimit.DEFAULT.value,
        )
    },
    required = emptyList(),
)

// Mirrors the constraints VocabularyName enforces in common/domain/Vocabulary.kt.
private val CREATE_BOOK_AUTHOR_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("name") {
            put("type", "string")
            put("description", "The author's name.")
            put("minLength", 1)
            put("maxLength", VocabularyName.MAX_LENGTH)
        }
    },
    required = listOf("name"),
)

// Mirrors the constraint VocabularySearchLimit enforces; search_book_narrators has no request DTO of its own.
private val SEARCH_BOOK_NARRATORS_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putQueryProperty(
            "Name prefix to search for. Leave empty to list every narrator alphabetically.",
            minLength = null,
        )
        putPageSizeProperty(
            "How many narrators to return at most. Defaults to 10, ${VocabularySearchLimit.MAX} at most.",
            max = VocabularySearchLimit.MAX,
            default = VocabularySearchLimit.DEFAULT.value,
        )
    },
    required = emptyList(),
)

// Mirrors the constraints VocabularyName enforces in common/domain/Vocabulary.kt.
private val CREATE_BOOK_NARRATOR_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("name") {
            put("type", "string")
            put("description", "The narrator's name.")
            put("minLength", 1)
            put("maxLength", VocabularyName.MAX_LENGTH)
        }
    },
    required = listOf("name"),
)

// Mirrors the constraint VocabularySearchLimit enforces; search_book_series has no request DTO of its own.
private val SEARCH_BOOK_SERIES_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putQueryProperty(
            "Name prefix to search for. Leave empty to list every series alphabetically.",
            minLength = null,
        )
        putPageSizeProperty(
            "How many series to return at most. Defaults to 10, ${VocabularySearchLimit.MAX} at most.",
            max = VocabularySearchLimit.MAX,
            default = VocabularySearchLimit.DEFAULT.value,
        )
    },
    required = emptyList(),
)

// Mirrors the constraints VocabularyName enforces in common/domain/Vocabulary.kt.
private val CREATE_BOOK_SERIES_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putJsonObject("name") {
            put("type", "string")
            put("description", "The name of the series.")
            put("minLength", 1)
            put("maxLength", VocabularyName.MAX_LENGTH)
        }
    },
    required = listOf("name"),
)

// McpJson ignores unknown keys, which would turn a typo into a silent no-op; the accepted names are derived from
// the request DTO's serial descriptor or the tool's schema, so they cannot drift.
@OptIn(ExperimentalSerializationApi::class)
private val UPDATE_BOOK_FIELDS: Set<String> = UpdateBookRequest.serializer().descriptor.elementNames.toSet()

@OptIn(ExperimentalSerializationApi::class)
private val CREATE_BOOK_FIELDS: Set<String> = CreateBookRequest.serializer().descriptor.elementNames.toSet()

private val SEARCH_BOOKS_FIELDS: Set<String> = SEARCH_BOOKS_SCHEMA.properties!!.keys

// Names the ordering search_books' text summary claims, matching what BookSort's own description says it does.
private fun BookSort.orderingWord(): String = when (this) {
    BookSort.TITLE -> "best first"
    BookSort.RELEASE_ASC -> "oldest release first"
    BookSort.RELEASE_DESC -> "newest release first"
}

@OptIn(ExperimentalSerializationApi::class)
private val CREATE_BOOK_NARRATOR_FIELDS: Set<String> =
    CreateBookNarratorRequest.serializer().descriptor.elementNames.toSet()

@OptIn(ExperimentalSerializationApi::class)
private val CREATE_BOOK_SERIES_FIELDS: Set<String> =
    CreateBookSeriesRequest.serializer().descriptor.elementNames.toSet()

@OptIn(ExperimentalSerializationApi::class)
private val SERIES_LINK_FIELDS: Set<String> = BookSeriesLinkRequest.serializer().descriptor.elementNames.toSet()

@OptIn(ExperimentalSerializationApi::class)
private val CREATE_BOOK_AUTHOR_FIELDS: Set<String> =
    CreateBookAuthorRequest.serializer().descriptor.elementNames.toSet()

// Only the PatchField-backed fields accept null to clear themselves; every other field on UpdateBookRequest is a
// plain nullable type where null would silently mean "unchanged", so it is derived as everything else.
private val UPDATE_BOOK_CLEARABLE = setOf("description", "coverImageUrl", "releaseDate")
private val UPDATE_BOOK_UNCLEARABLE = UPDATE_BOOK_FIELDS - UPDATE_BOOK_CLEARABLE

// Prose fragment for a book's year, precise date, authors, narrators and series, used in the text output; ids
// are structured content only. A series reads "Mistborn #1", or just the name when the book has no number.
private fun BookResponse.yearAndAuthors(): String {
    val date = releaseDate?.let { ", $it" } ?: ""
    val authorNames = if (authors.isEmpty()) "" else " by ${authors.joinToString(", ") { it.name }}"
    val narratorNames = if (narrators.isEmpty()) "" else "; narrated by ${narrators.joinToString(", ") { it.name }}"
    val seriesNames = if (series.isEmpty()) "" else "; series: ${series.joinToString(", ") { it.label() }}"
    return "$releaseYear$date$authorNames$narratorNames$seriesNames"
}

private fun BookSeriesEntryResponse.label(): String =
    position?.let { "$name #${BigDecimal(it.toString()).stripTrailingZeros().toPlainString()}" } ?: name

/** The element objects of `series` are not covered by the top-level field check; McpJson would drop typos there. */
private fun JsonObject.requireKnownSeriesLinkFields() {
    (this[BookSeriesId.FIELD] as? JsonArray)?.forEach { (it as? JsonObject)?.requireKnownFields(SERIES_LINK_FIELDS) }
}

private fun Server.addListBookTypesTool(bookService: BookService) {
    addTool(
        name = "list_book_types",
        description = LIST_BOOK_TYPES_DESCRIPTION,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { _ ->
        val types = bookService.listTypes().map { it.toResponse() }
        CallToolResult(
            content = listOf(TextContent(types.joinToString("\n") { "${it.label}: ${it.id}" })),
            structuredContent = buildJsonObject {
                putJsonArray("types") {
                    types.forEach { type ->
                        addJsonObject {
                            put("id", type.id)
                            put("label", type.label)
                        }
                    }
                }
            },
        )
    }
}

private fun Server.addAddBookTool(bookService: BookService) {
    addTool(
        name = "add_book",
        description = ADD_BOOK_DESCRIPTION,
        inputSchema = ADD_BOOK_SCHEMA,
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            arguments.requireKnownFields(CREATE_BOOK_FIELDS)
            arguments.requireKnownSeriesLinkFields()
            val createRequest = McpJson.decodeFromJsonElement(CreateBookRequest.serializer(), arguments)
            val response = bookService.create(createRequest.toNewBook()).toResponse()
            CallToolResult(
                content = listOf(
                    TextContent(
                        "Created book \"${response.title}\" (${response.yearAndAuthors()}) with id ${response.id}.",
                    ),
                ),
                structuredContent = McpJson.encodeToJsonElement(BookResponse.serializer(), response).jsonObject,
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

private fun Server.addSearchBooksTool(bookService: BookService) {
    addTool(
        name = "search_books",
        description = SEARCH_BOOKS_DESCRIPTION,
        inputSchema = SEARCH_BOOKS_SCHEMA,
        toolAnnotations = ToolAnnotations(readOnlyHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            // McpJson ignores unknown keys, which would turn a typo'd filter name into a silently unfiltered
            // search instead of an error; reject it here instead, as update_book does.
            arguments.requireKnownFields(SEARCH_BOOKS_FIELDS)
            val term = SearchTerm.parseOrNull(arguments.stringOrNull("query"), field = "query")
            val filters = BookFilters(
                typeIds = arguments.stringArrayOrNull(BookTypeId.FIELD)
                    ?.map(BookTypeId::parse)?.toSet() ?: emptySet(),
                ownership = arguments.stringArrayOrNull(BookOwnership.FIELD)
                    ?.map(BookOwnership::from)?.toSet() ?: emptySet(),
                progress = arguments.stringArrayOrNull(BookProgress.FIELD)
                    ?.map(BookProgress::from)?.toSet() ?: emptySet(),
                releaseYears = arguments.intArrayOrNull("releaseYears")
                    ?.map(::ReleaseYear)?.toSet() ?: emptySet(),
                missing = arguments.stringArrayOrNull(BookMissingField.FIELD)
                    ?.map(BookMissingField::from)?.toSet() ?: emptySet(),
            )
            requireValid("query", term != null || !filters.isEmpty) { "provide a query or at least one filter" }
            val size = arguments.sizeOrNull(PageSize.FIELD, SEARCH_BOOKS_MAX_SIZE)?.let(::PageSize)
                ?: SEARCH_BOOKS_DEFAULT_SIZE
            val sort = arguments.stringOrNull(BookSort.FIELD)?.let(BookSort::from) ?: BookSort.DEFAULT
            val page = bookService.list(PageRequest(PageNumber.FIRST, size), term, filters, sort)
            val books = page.items.map { it.toResponse() }
            val subject = term?.let { "\"$it\"" } ?: "the given filters"
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (books.isEmpty()) {
                            "No books match $subject."
                        } else {
                            "${books.size} of ${page.totalItems} matches for $subject, ${sort.orderingWord()}:\n" +
                                books.joinToString("\n") { "${it.title} (${it.yearAndAuthors()}): ${it.id}" }
                        },
                    ),
                ),
                structuredContent = buildJsonObject {
                    put("totalMatches", page.totalItems)
                    put("truncated", page.totalItems > books.size)
                    putJsonArray("books") {
                        books.forEach { book ->
                            add(McpJson.encodeToJsonElement(BookResponse.serializer(), book))
                        }
                    }
                },
            )
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        }
    }
}

private fun Server.addUpdateBookTool(bookService: BookService) {
    addTool(
        name = "update_book",
        description = UPDATE_BOOK_DESCRIPTION,
        inputSchema = UPDATE_BOOK_SCHEMA,
        toolAnnotations = ToolAnnotations(idempotentHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            val id = BookId.parse(arguments.stringOrNull("id") ?: throw InvalidValueException("id", "is missing"))
            val fields = JsonObject(arguments - "id")
            fields.requireKnownFields(UPDATE_BOOK_FIELDS)
            fields.requireKnownSeriesLinkFields()
            requireValid("arguments", fields.isNotEmpty()) { "must change at least one field" }
            fields.requireNotCleared(UPDATE_BOOK_UNCLEARABLE)
            val patch = McpJson.decodeFromJsonElement(UpdateBookRequest.serializer(), fields).toPatch()
            val book = bookService.update(id, patch).toResponse()
            CallToolResult(
                content = listOf(
                    TextContent(
                        "Updated ${fields.keys.sorted().joinToString()} of \"${book.title}\" " +
                            "(${book.yearAndAuthors()}).",
                    ),
                ),
                structuredContent = McpJson.encodeToJsonElement(BookResponse.serializer(), book).jsonObject,
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

private fun Server.addSearchBookAuthorsTool(bookAuthorService: BookAuthorService) {
    addSearchVocabularyTool(
        name = "search_book_authors",
        description = SEARCH_BOOK_AUTHORS_DESCRIPTION,
        inputSchema = SEARCH_BOOK_AUTHORS_SCHEMA,
        entryNounPlural = "authors",
    ) { term, limit ->
        bookAuthorService.search(term, limit).map { it.toResponse().let { r -> VocabularyEntryView(r.id, r.name) } }
    }
}

private fun Server.addCreateBookAuthorTool(bookAuthorService: BookAuthorService) {
    addCreateVocabularyTool(
        name = "create_book_author",
        description = CREATE_BOOK_AUTHOR_DESCRIPTION,
        inputSchema = CREATE_BOOK_AUTHOR_SCHEMA,
        knownFields = CREATE_BOOK_AUTHOR_FIELDS,
        entryNoun = "author",
    ) { arguments ->
        val createRequest = McpJson.decodeFromJsonElement(CreateBookAuthorRequest.serializer(), arguments)
        val result = bookAuthorService.create(VocabularyName.parse(createRequest.name))
        val response = result.entry.toResponse()
        VocabularyCreation(VocabularyEntryView(response.id, response.name), result.created)
    }
}

private fun Server.addSearchBookNarratorsTool(bookNarratorService: BookNarratorService) {
    addSearchVocabularyTool(
        name = "search_book_narrators",
        description = SEARCH_BOOK_NARRATORS_DESCRIPTION,
        inputSchema = SEARCH_BOOK_NARRATORS_SCHEMA,
        entryNounPlural = "narrators",
    ) { term, limit ->
        bookNarratorService.search(term, limit).map { it.toResponse().let { r -> VocabularyEntryView(r.id, r.name) } }
    }
}

private fun Server.addCreateBookNarratorTool(bookNarratorService: BookNarratorService) {
    addCreateVocabularyTool(
        name = "create_book_narrator",
        description = CREATE_BOOK_NARRATOR_DESCRIPTION,
        inputSchema = CREATE_BOOK_NARRATOR_SCHEMA,
        knownFields = CREATE_BOOK_NARRATOR_FIELDS,
        entryNoun = "narrator",
    ) { arguments ->
        val createRequest = McpJson.decodeFromJsonElement(CreateBookNarratorRequest.serializer(), arguments)
        val result = bookNarratorService.create(VocabularyName.parse(createRequest.name))
        val response = result.entry.toResponse()
        VocabularyCreation(VocabularyEntryView(response.id, response.name), result.created)
    }
}

private fun Server.addSearchBookSeriesTool(bookSeriesService: BookSeriesService) {
    addSearchVocabularyTool(
        name = "search_book_series",
        description = SEARCH_BOOK_SERIES_DESCRIPTION,
        inputSchema = SEARCH_BOOK_SERIES_SCHEMA,
        entryNounPlural = "series",
    ) { term, limit ->
        bookSeriesService.search(term, limit).map { it.toResponse().let { r -> VocabularyEntryView(r.id, r.name) } }
    }
}

private fun Server.addCreateBookSeriesTool(bookSeriesService: BookSeriesService) {
    addCreateVocabularyTool(
        name = "create_book_series",
        description = CREATE_BOOK_SERIES_DESCRIPTION,
        inputSchema = CREATE_BOOK_SERIES_SCHEMA,
        knownFields = CREATE_BOOK_SERIES_FIELDS,
        entryNoun = "series",
    ) { arguments ->
        val createRequest = McpJson.decodeFromJsonElement(CreateBookSeriesRequest.serializer(), arguments)
        val result = bookSeriesService.create(VocabularyName.parse(createRequest.name))
        val response = result.entry.toResponse()
        VocabularyCreation(VocabularyEntryView(response.id, response.name), result.created)
    }
}

private const val FIND_BOOK_COVER_DESCRIPTION =
    "Looks up a cover image for a book. source book (default) searches Open Library for printed books and " +
        "e-books, audiobook searches the Audible catalog. Pass the book's full official title; passing the " +
        "release year as well improves the ranking when several books share a similar title. Returns the first " +
        "cover of the best match, together with the match's title, authors and release year - check them " +
        "before trusting the image, since the match can be wrong. On a hit, pass the returned imageUrl as " +
        "coverImageUrl to add_book or update_book; search_books with hasMissing: [\"coverImageUrl\"] finds " +
        "tracked books that still need one."

// Mirrors the constraints SearchTerm and ReleaseYear enforce; find_book_cover has no request DTO of its own.
private val FIND_BOOK_COVER_SCHEMA = ToolSchema(
    properties = buildJsonObject {
        putTitleProperty("The book's full official title.", maxLength = SearchTerm.MAX_LENGTH)
        putReleaseYearProperty("The four-digit release year; improves ranking when several titles are similar.")
        putEnumProperty(
            BookCoverSourceKind.FIELD,
            BookCoverSourceKind.entries,
            "Where to look: book (default) for printed books and e-books, audiobook for audiobooks.",
        )
    },
    required = listOf("title"),
)

private val FIND_BOOK_COVER_FIELDS: Set<String> = FIND_BOOK_COVER_SCHEMA.properties!!.keys

private fun Server.addFindBookCoverTool(bookCoverOptionsService: BookCoverOptionsService) {
    addTool(
        name = "find_book_cover",
        description = FIND_BOOK_COVER_DESCRIPTION,
        inputSchema = FIND_BOOK_COVER_SCHEMA,
        toolAnnotations = ToolAnnotations(readOnlyHint = true, openWorldHint = true),
    ) { request ->
        try {
            val arguments = request.arguments ?: JsonObject(emptyMap())
            arguments.requireKnownFields(FIND_BOOK_COVER_FIELDS)
            val title = SearchTerm.parseOrNull(arguments.stringOrNull("title"), field = "title")
                ?: throw InvalidValueException("title", "is missing")
            val releaseYear = arguments.intOrNull("releaseYear")?.let(::ReleaseYear)
            val source = arguments.stringOrNull(BookCoverSourceKind.FIELD)?.let(BookCoverSourceKind::from)
                ?: BookCoverSourceKind.DEFAULT
            val lookup = bookCoverOptionsService.findFirstCover(title, releaseYear, source)
            if (lookup == null) {
                CallToolResult(
                    content = listOf(TextContent("No cover found for \"$title\".")),
                    structuredContent = buildJsonObject { put("found", false) },
                )
            } else {
                val authors = lookup.authors.joinToString(", ").ifEmpty { "author unknown" }
                val year = lookup.releaseYear?.value?.toString() ?: "year unknown"
                CallToolResult(
                    content = listOf(
                        TextContent("Cover for \"${lookup.name}\" ($authors, $year): ${lookup.cover.imageUrl.value}"),
                    ),
                    structuredContent = buildJsonObject {
                        put("found", true)
                        put("imageUrl", lookup.cover.imageUrl.value)
                        put("source", source.wire)
                        putJsonObject("match") {
                            put("name", lookup.name)
                            putJsonArray("authors") { lookup.authors.forEach { add(it) } }
                            put("releaseYear", lookup.releaseYear?.value)
                        }
                    },
                )
            }
        } catch (e: InvalidValueException) {
            e.toErrorResult()
        } catch (e: ExternalSourceException) {
            // Mirrors StatusPages: log the real failure at warn, never echo it to the client.
            log.warn("External source '${e.source}' call failed", e)
            CallToolResult(
                content = listOf(TextContent("${e.source} is currently unavailable")),
                isError = true,
            )
        }
    }
}
