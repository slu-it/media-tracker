package de.sluit.mediatracker.mcp.api

import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.SeededBookTypes
import de.sluit.mediatracker.books.author
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorService
import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookMissingField
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookPatch
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookService
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.NewBook
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.handlerApp
import io.ktor.client.HttpClient
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Handler tests for the book MCP tools on `POST /mcp`: real plugins and routes through [handlerApp], the book
 * services are strict MockK mocks, no database is opened. Pins the tool arguments, the domain values a tool
 * hands to the services and the tool-error paths.
 */
class BookMcpRoutesTest {
    private val key = "0f1d3b52-6c1e-4a7a-9a0e-2f7e5c1d1234"

    private fun ApplicationTestBuilder.mcpClient(
        books: BookService = mockk(),
        authors: BookAuthorService = mockk(),
    ): HttpClient {
        val apiKeys = mockk<ApiKeyService>()
        coEvery { apiKeys.authenticate(key) } returns User(1, "alice", "hash")
        return handlerApp(apiKeys = apiKeys, books = books, bookAuthors = authors)
    }

    private suspend fun HttpClient.callTool(name: String, arguments: String): JsonObject {
        val response = postJsonRpc(
            key,
            """{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"$name","arguments":$arguments}}""",
        )
        val body = response.bodyAsText()
        assertEquals(HttpStatusCode.OK, response.status, body)
        return Json.parseToJsonElement(body).jsonObject["result"]!!.jsonObject
    }

    private fun JsonObject.assertSuccess() = assertNull(this["isError"], toString())

    private fun JsonObject.assertToolError() =
        assertTrue(this["isError"]!!.jsonPrimitive.content.toBoolean(), toString())

    private fun JsonObject.structured(): JsonObject = this["structuredContent"]!!.jsonObject

    // ---- list_book_types ----

    @Test
    fun `list_book_types returns the types as structured content`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        coEvery { books.listTypes() } returns listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)

        val result = client.callTool("list_book_types", "{}")

        result.assertSuccess()
        val types = result.structured()["types"]!!.jsonArray
        assertEquals(listOf("Hardcover", "Kindle"), types.map { it.jsonObject["label"]!!.jsonPrimitive.content })
        assertEquals(
            listOf(SeededBookTypes.HARDCOVER, SeededBookTypes.KINDLE),
            types.map { it.jsonObject["id"]!!.jsonPrimitive.content },
        )
    }

    // ---- add_book ----

    @Test
    fun `add_book creates the book with the parsed arguments`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        val captured = slot<NewBook>()
        val authorId = BookAuthorId.new()
        coEvery { books.create(capture(captured)) } returns
            book("Dune", releaseYear = 1965, authors = listOf(author("Frank Herbert", authorId)))

        val result = client.callTool(
            "add_book",
            """{"title":"Dune","releaseYear":1965,"ownership":"owned","progress":"reading",
                |"typeIds":["${SeededBookTypes.KINDLE}"],"authorIds":["$authorId"]}
            """.trimMargin(),
        )

        result.assertSuccess()
        assertEquals("Dune", result.structured()["title"]!!.jsonPrimitive.content)
        assertEquals(
            NewBook(
                title = Title("Dune"),
                releaseYear = ReleaseYear(1965),
                typeIds = setOf(BookTypeId.parse(SeededBookTypes.KINDLE)),
                authorIds = setOf(authorId),
                ownership = BookOwnership.OWNED,
                progress = BookProgress.READING,
            ),
            captured.captured,
        )
    }

    @Test
    fun `add_book with a releaseDate but no releaseYear derives the year`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        val captured = slot<NewBook>()
        coEvery { books.create(capture(captured)) } returns book("Dune")

        client.callTool("add_book", """{"title":"Dune","releaseDate":"1965-08-01"}""").assertSuccess()

        assertEquals(ReleaseYear(1965), captured.captured.releaseYear)
        assertEquals(ReleaseDate.parse("1965-08-01"), captured.captured.releaseDate)
    }

    @Test
    fun `add_book without year and date is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("add_book", """{"title":"Dune"}""").assertToolError()
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `add_book rejects an unknown argument`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("add_book", """{"title":"Dune","releaseYear":1965,"authorIDs":[]}""").assertToolError()
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `add_book with a missing title is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("add_book", """{"releaseYear":1965}""").assertToolError()
    }

    @Test
    fun `add_book with an unknown type id is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        coEvery { books.create(any()) } throws NotFoundException("book_type", "x")

        client.callTool("add_book", """{"title":"Dune","releaseYear":1965}""").assertToolError()
    }

    @Test
    fun `add_book rejects ownership subscription`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("add_book", """{"title":"Dune","releaseYear":1965,"ownership":"subscription"}""")
            .assertToolError()
        coVerify(exactly = 0) { books.create(any()) }
    }

    // ---- search_books ----

    @Test
    fun `search_books passes the query filters and default page size to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        coEvery { books.list(any(), any(), any()) } returns
            Page(listOf(book("Dune")), PageNumber.FIRST, PageSize(10), 1)

        val result = client.callTool(
            "search_books",
            """{"query":"dune","typeIds":["${SeededBookTypes.KINDLE}"],"ownership":["owned"],
                |"progress":["reading","paused"],"releaseYears":[1965],"hasMissing":["description"]}
            """.trimMargin(),
        )

        result.assertSuccess()
        coVerify {
            books.list(
                PageRequest(PageNumber.FIRST, PageSize(10)),
                SearchTerm("dune"),
                BookFilters(
                    typeIds = setOf(BookTypeId.parse(SeededBookTypes.KINDLE)),
                    ownership = setOf(BookOwnership.OWNED),
                    progress = setOf(BookProgress.READING, BookProgress.PAUSED),
                    releaseYears = setOf(ReleaseYear(1965)),
                    missing = setOf(BookMissingField.DESCRIPTION),
                ),
            )
        }
    }

    @Test
    fun `search_books reports totalMatches and truncated`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        coEvery { books.list(any(), any(), any()) } returns
            Page(listOf(book("Dune"), book("Dune Messiah")), PageNumber.FIRST, PageSize(2), 7)

        val structured = client.callTool("search_books", """{"query":"dune","pageSize":2}""").structured()

        assertEquals(7, structured["totalMatches"]!!.jsonPrimitive.content.toInt())
        assertTrue(structured["truncated"]!!.jsonPrimitive.content.toBoolean())
        assertEquals(2, structured["books"]!!.jsonArray.size)
        coVerify { books.list(PageRequest(PageNumber.FIRST, PageSize(2)), any(), any()) }
    }

    @Test
    fun `search_books with a filter only is allowed`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        coEvery { books.list(any(), any(), any()) } returns Page(emptyList(), PageNumber.FIRST, PageSize(10), 0)

        val result = client.callTool("search_books", """{"progress":["reading"]}""")

        result.assertSuccess()
        assertEquals(false, result.structured()["truncated"]!!.jsonPrimitive.content.toBoolean())
    }

    @Test
    fun `search_books without query and filter is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("search_books", "{}").assertToolError()
        coVerify(exactly = 0) { books.list(any(), any(), any()) }
    }

    @Test
    fun `search_books rejects a page size above 100`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("search_books", """{"query":"x","pageSize":101}""").assertToolError()
    }

    @Test
    fun `search_books rejects an unknown argument`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("search_books", """{"query":"x","releaseYear":[1965]}""").assertToolError()
        coVerify(exactly = 0) { books.list(any(), any(), any()) }
    }

    @Test
    fun `search_books rejects progress playing`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("search_books", """{"progress":["playing"]}""").assertToolError()
    }

    // ---- update_book ----

    @Test
    fun `update_book maps null to clear and empty arrays to cleared sets`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        val id = BookId.new()
        val captured = slot<BookPatch>()
        coEvery { books.update(id, capture(captured)) } returns book("Dune", id = id)

        val result = client.callTool(
            "update_book",
            """{"id":"$id","description":null,"coverImageUrl":null,"releaseDate":null,"typeIds":[],"authorIds":[]}""",
        )

        result.assertSuccess()
        assertEquals(Patch.Change(null), captured.captured.description)
        assertEquals(Patch.Change(null), captured.captured.coverImageUrl)
        assertEquals(Patch.Change(null), captured.captured.releaseDate)
        assertEquals(emptySet(), captured.captured.typeIds)
        assertEquals(emptySet(), captured.captured.authorIds)
    }

    @Test
    fun `update_book maps values and leaves omitted fields unchanged`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        val id = BookId.new()
        val captured = slot<BookPatch>()
        coEvery { books.update(id, capture(captured)) } returns book("Dune", id = id)

        client.callTool(
            "update_book",
            """{"id":"$id","description":"Spice.","progress":"finished"}""",
        ).assertSuccess()

        assertEquals(
            BookPatch(description = Patch.Change(Description("Spice.")), progress = BookProgress.FINISHED),
            captured.captured,
        )
    }

    @Test
    fun `update_book with only an id is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("update_book", """{"id":"${BookId.new()}"}""").assertToolError()
    }

    @Test
    fun `update_book without an id is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("update_book", """{"title":"x"}""").assertToolError()
    }

    @Test
    fun `update_book rejects null for an unclearable field`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("update_book", """{"id":"${BookId.new()}","ownership":null}""").assertToolError()
        client.callTool("update_book", """{"id":"${BookId.new()}","title":null}""").assertToolError()
        client.callTool("update_book", """{"id":"${BookId.new()}","typeIds":null}""").assertToolError()
    }

    @Test
    fun `update_book rejects an unknown field`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)

        client.callTool("update_book", """{"id":"${BookId.new()}","rating":4}""").assertToolError()
    }

    @Test
    fun `update_book of an unknown book is a tool error`() = testApplication {
        val books = mockk<BookService>()
        val client = mcpClient(books)
        val id = BookId.new()
        coEvery { books.update(id, any()) } throws NotFoundException("book", id.toString())

        client.callTool("update_book", """{"id":"$id","title":"x"}""").assertToolError()
    }

    // ---- authors ----

    @Test
    fun `search_book_authors returns the authors as structured content`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)
        val herbert = author("Frank Herbert")
        coEvery { authors.search(SearchTerm("fra"), VocabularySearchLimit(5)) } returns listOf(herbert)

        val result = client.callTool("search_book_authors", """{"query":"fra","pageSize":5}""")

        result.assertSuccess()
        val entries = result.structured()["authors"]!!.jsonArray
        assertEquals(herbert.id.toString(), entries.single().jsonObject["id"]!!.jsonPrimitive.content)
        assertEquals("Frank Herbert", entries.single().jsonObject["name"]!!.jsonPrimitive.content)
        coVerify { authors.search(SearchTerm("fra"), VocabularySearchLimit(5)) }
    }

    @Test
    fun `search_book_authors without arguments lists with the default limit`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)
        coEvery { authors.search(null, VocabularySearchLimit.DEFAULT) } returns emptyList()

        client.callTool("search_book_authors", "{}").assertSuccess()

        coVerify { authors.search(null, VocabularySearchLimit.DEFAULT) }
    }

    @Test
    fun `search_book_authors rejects an unknown argument`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)

        client.callTool("search_book_authors", """{"name":"x"}""").assertToolError()
    }

    @Test
    fun `create_book_author reports created true for a new author`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)
        val herbert = author("Frank Herbert")
        coEvery { authors.create(VocabularyName("Frank Herbert")) } returns VocabularyCreation(herbert, true)

        val result = client.callTool("create_book_author", """{"name":"Frank Herbert"}""")

        result.assertSuccess()
        assertEquals(herbert.id.toString(), result.structured()["id"]!!.jsonPrimitive.content)
        assertTrue(result.structured()["created"]!!.jsonPrimitive.content.toBoolean())
    }

    @Test
    fun `create_book_author reports created false for an existing author`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)
        coEvery { authors.create(any()) } returns VocabularyCreation(author("Frank Herbert"), false)

        val result = client.callTool("create_book_author", """{"name":"frank herbert"}""")

        result.assertSuccess()
        assertEquals(false, result.structured()["created"]!!.jsonPrimitive.content.toBoolean())
    }

    @Test
    fun `create_book_author with a blank name is a tool error`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)

        client.callTool("create_book_author", """{"name":" "}""").assertToolError()
        coVerify(exactly = 0) { authors.create(any()) }
    }

    @Test
    fun `create_book_author without a name is a tool error`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = mcpClient(authors = authors)

        client.callTool("create_book_author", "{}").assertToolError()
    }
}
