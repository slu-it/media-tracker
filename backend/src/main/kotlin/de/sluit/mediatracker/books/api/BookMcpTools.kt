package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorService
import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookMissingField
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookService
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.common.api.MAX_FILTER_VALUES
import de.sluit.mediatracker.common.api.VocabularyEntryView
import de.sluit.mediatracker.common.api.addCreateVocabularyTool
import de.sluit.mediatracker.common.api.addSearchVocabularyTool
import de.sluit.mediatracker.common.api.intArrayOrNull
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/**
 * Registers the MCP tools the books feature offers on [server]: [de.sluit.mediatracker.mcpRoutes] calls this once
 * per request, exactly as [bookRoutes] contributes the REST routes. There is no delete tool, as for games.
 */
fun Server.addBookTools(bookService: BookService, bookAuthorService: BookAuthorService) {
    addListBookTypesTool(bookService)
    addAddBookTool(bookService)
    addSearchBooksTool(bookService)
    addUpdateBookTool(bookService)
    addSearchBookAuthorsTool(bookAuthorService)
    addCreateBookAuthorTool(bookAuthorService)
}

private const val LIST_BOOK_TYPES_DESCRIPTION =
    "Lists the book types this tracker knows (hardcover, paperback, Kindle, ...), with the ids add_book and " +
        "update_book expect in typeIds. Types are optional: a book may have none."

private const val ADD_BOOK_DESCRIPTION =
    "Adds a book to the tracker. title is required; releaseYear is required unless releaseDate is given, in " +
        "which case the date's year is used instead (and overrides a releaseYear that contradicts it), so " +
        "releaseYear may then be omitted. description and coverImageUrl are optional. authorIds are optional " +
        "book_authors.id values; call search_book_authors first to look them up, and create_book_author for " +
        "any author that search does not find, then pass the ids here. typeIds are optional book_types.id " +
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
        "whose description or cover image is still empty, so they can be filled in with update_book. At " +
        "least one of query or a filter is required. Each match carries the id update_book needs to change " +
        "it. pageSize controls how many matches come back, 10 by default and 100 at most."

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
        "first). An empty array clears typeIds or authorIds, it does not need null. Passing nothing but id, " +
        "or a field name that is not in the schema, is an error."

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
    },
    required = listOf("id"),
)

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

// McpJson ignores unknown keys, which would turn a typo into a silent no-op; the accepted names are derived from
// the request DTO's serial descriptor or the tool's schema, so they cannot drift.
@OptIn(ExperimentalSerializationApi::class)
private val UPDATE_BOOK_FIELDS: Set<String> = UpdateBookRequest.serializer().descriptor.elementNames.toSet()

@OptIn(ExperimentalSerializationApi::class)
private val CREATE_BOOK_FIELDS: Set<String> = CreateBookRequest.serializer().descriptor.elementNames.toSet()

private val SEARCH_BOOKS_FIELDS: Set<String> = SEARCH_BOOKS_SCHEMA.properties!!.keys

@OptIn(ExperimentalSerializationApi::class)
private val CREATE_BOOK_AUTHOR_FIELDS: Set<String> =
    CreateBookAuthorRequest.serializer().descriptor.elementNames.toSet()

// Only the PatchField-backed fields accept null to clear themselves; every other field on UpdateBookRequest is a
// plain nullable type where null would silently mean "unchanged", so it is derived as everything else.
private val UPDATE_BOOK_CLEARABLE = setOf("description", "coverImageUrl", "releaseDate")
private val UPDATE_BOOK_UNCLEARABLE = UPDATE_BOOK_FIELDS - UPDATE_BOOK_CLEARABLE

// Prose fragment for a book's year, precise date and known authors, used in the text output; ids are
// structured content only.
private fun BookResponse.yearAndAuthors(): String {
    val date = releaseDate?.let { ", $it" } ?: ""
    val authorNames = if (authors.isEmpty()) "" else " by ${authors.joinToString(", ") { it.name }}"
    return "$releaseYear$date$authorNames"
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
            val page = bookService.list(PageRequest(PageNumber.FIRST, size), term, filters)
            val books = page.items.map { it.toResponse() }
            val subject = term?.let { "\"$it\"" } ?: "the given filters"
            CallToolResult(
                content = listOf(
                    TextContent(
                        if (books.isEmpty()) {
                            "No books match $subject."
                        } else {
                            "${books.size} of ${page.totalItems} matches for $subject, best first:\n" +
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
