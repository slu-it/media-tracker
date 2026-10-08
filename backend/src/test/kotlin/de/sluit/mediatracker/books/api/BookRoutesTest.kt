package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.SeededBookTypes
import de.sluit.mediatracker.books.author
import de.sluit.mediatracker.books.book
import de.sluit.mediatracker.books.domain.BookAuthorId
import de.sluit.mediatracker.books.domain.BookAuthorService
import de.sluit.mediatracker.books.domain.BookFilters
import de.sluit.mediatracker.books.domain.BookId
import de.sluit.mediatracker.books.domain.BookMeta
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookNarratorService
import de.sluit.mediatracker.books.domain.BookOwnership
import de.sluit.mediatracker.books.domain.BookPatch
import de.sluit.mediatracker.books.domain.BookProgress
import de.sluit.mediatracker.books.domain.BookSeriesId
import de.sluit.mediatracker.books.domain.BookSeriesPosition
import de.sluit.mediatracker.books.domain.BookSeriesService
import de.sluit.mediatracker.books.domain.BookService
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.NewBook
import de.sluit.mediatracker.books.narrator
import de.sluit.mediatracker.books.series
import de.sluit.mediatracker.books.seriesEntry
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.api.MAX_FILTER_VALUES
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.InvalidValueException
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
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

/**
 * Handler tests for `/api/books`, `/api/book-types`, `/api/books.meta` and `/api/book-authors`: real plugins and
 * routes through [handlerApp], the services are strict MockK mocks, sessions live in memory, no database is
 * opened. They pin the HTTP contract mirrored in `frontend/src/types/api.ts` and the exact domain values the
 * handlers hand to the services.
 */
class BookRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(
        books: BookService = mockk(),
        authors: BookAuthorService = mockk(),
        narrators: BookNarratorService = mockk(),
        series: BookSeriesService = mockk(),
    ): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(
            auth,
            books = books,
            bookAuthors = authors,
            bookNarrators = narrators,
            bookSeries = series,
        )
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpClient.createBook(body: String): HttpResponse = post("/api/books") { jsonBody(body) }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    private suspend fun HttpResponse.assertValidationError(field: String) {
        val error = assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("$field:"), error.message)
    }

    private fun emptyPage() =
        Page(emptyList<de.sluit.mediatracker.books.domain.Book>(), PageNumber.FIRST, PageSize.DEFAULT, 0)

    // ---- auth ----

    @Test
    fun `anonymous access is rejected with json 401 without reaching the services`() = testApplication {
        val books = mockk<BookService>()
        val authors = mockk<BookAuthorService>()
        val client = handlerApp(books = books, bookAuthors = authors)

        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/books").status)
        assertEquals(HttpStatusCode.Unauthorized, client.createBook("{}").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/book-types").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/books.meta").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/book-authors").status)
        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/book-authors").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/book-narrators").status)
        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/book-narrators").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/book-series").status)
        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/book-series").status)
    }

    // ---- create ----

    @Test
    fun `create returns 201 with a location header pointing at the new book`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val created = book("Dune")
        coEvery { books.create(any()) } returns created

        val response = client.createBook("""{"title":"Dune","releaseYear":1965}""")

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals("/api/books/${created.id}", response.headers["Location"])
    }

    @Test
    fun `create response mirrors the returned book including types and authors`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val created = book(
            "Dune",
            types = listOf(BookTypes.KINDLE, BookTypes.HARDCOVER),
            authors = listOf(author("Frank Herbert")),
            releaseDate = ReleaseDate.parse("1965-08-01"),
            description = Description("Spice."),
            coverImageUrl = CoverImageUrl("https://img.example/d.png"),
            ownership = BookOwnership.OWNED,
            progress = BookProgress.READING,
        )
        coEvery { books.create(any()) } returns created

        val response = client.createBook("""{"title":"Dune","releaseYear":1965}""").decodeBody<BookResponse>()

        assertEquals(created.id.toString(), response.id)
        assertEquals(1965, response.releaseYear)
        assertEquals("1965-08-01", response.releaseDate)
        assertEquals("Spice.", response.description)
        assertEquals("https://img.example/d.png", response.coverImageUrl)
        assertEquals("owned", response.ownership)
        assertEquals("reading", response.progress)
        assertEquals(listOf("Hardcover", "Kindle"), response.types.map { it.label })
        assertEquals("5D4037", response.types.first().associatedColor)
        assertEquals(listOf("Frank Herbert"), response.authors.map { it.name })
    }

    @Test
    fun `create response renders missing optional fields as explicit nulls and empty lists`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.create(any()) } returns book("Dune")

        val body = client.createBook("""{"title":"Dune","releaseYear":1965}""").bodyAsText()

        assertContains(body, "\"description\":null")
        assertContains(body, "\"coverImageUrl\":null")
        assertContains(body, "\"releaseDate\":null")
        assertContains(body, "\"types\":[]")
        assertContains(body, "\"authors\":[]")
        assertContains(body, "\"narrators\":[]")
        assertContains(body, "\"series\":[]")
    }

    @Test
    fun `create hands the parsed request to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val captured = slot<NewBook>()
        coEvery { books.create(capture(captured)) } returns book("Dune")
        val authorId = Uuid.random().toString()

        client.createBook(
            """{"title":"Dune","releaseYear":1965,"description":"Spice.","coverImageUrl":"https://img.example/d.png",
                |"ownership":"owned","progress":"reading","typeIds":["${SeededBookTypes.KINDLE}"],
                |"authorIds":["$authorId"]}
            """.trimMargin(),
        )

        with(captured.captured) {
            assertEquals(Title("Dune"), title)
            assertEquals(ReleaseYear(1965), releaseYear)
            assertEquals(Description("Spice."), description)
            assertEquals(CoverImageUrl("https://img.example/d.png"), coverImageUrl)
            assertEquals(BookOwnership.OWNED, ownership)
            assertEquals(BookProgress.READING, progress)
            assertEquals(setOf(BookTypeId.parse(SeededBookTypes.KINDLE)), typeIds)
            assertEquals(setOf(BookAuthorId.parse(authorId)), authorIds)
        }
    }

    @Test
    fun `create without optional fields uses the defaults and empty sets`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val captured = slot<NewBook>()
        coEvery { books.create(capture(captured)) } returns book("Dune")

        client.createBook("""{"title":"Dune","releaseYear":1965}""")

        with(captured.captured) {
            assertNull(description)
            assertNull(coverImageUrl)
            assertNull(releaseDate)
            assertEquals(BookOwnership.WATCHLIST, ownership)
            assertEquals(BookProgress.NOT_STARTED, progress)
            assertEquals(emptySet(), typeIds)
            assertEquals(emptySet(), authorIds)
        }
    }

    @Test
    fun `create with a release date may omit the release year`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val captured = slot<NewBook>()
        coEvery { books.create(capture(captured)) } returns book("Dune")

        val response = client.createBook("""{"title":"Dune","releaseDate":"1965-08-01"}""")

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals(ReleaseYear(1965), captured.captured.releaseYear)
        assertEquals(ReleaseDate.parse("1965-08-01"), captured.captured.releaseDate)
    }

    @Test
    fun `create with neither release year nor release date is a 400`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"title":"Dune"}""").assertValidationError("releaseYear")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `create rejects a blank title`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"title":"  ","releaseYear":1965}""").assertValidationError("title")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `create rejects ownership subscription`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"title":"x","releaseYear":1965,"ownership":"subscription"}""")
            .assertValidationError("ownership")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `create rejects progress playing`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"title":"x","releaseYear":1965,"progress":"playing"}""")
            .assertValidationError("progress")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `create rejects a malformed type id`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"title":"x","releaseYear":1965,"typeIds":["nope"]}""").assertValidationError("typeIds")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `create rejects a malformed author id`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"title":"x","releaseYear":1965,"authorIds":["nope"]}""")
            .assertValidationError("authorIds")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `a validation error thrown by the service is a 400 validation_error`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.create(any()) } throws InvalidValueException(BookTypeId.FIELD, "unknown type id")

        client.createBook("""{"title":"x","releaseYear":1965}""").assertValidationError("typeIds")
    }

    @Test
    fun `create with a missing required field is 400 invalid_body`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.createBook("""{"releaseYear":1965}""").assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { books.create(any()) }
    }

    // ---- list ----

    @Test
    fun `list without parameters asks the service for page 1 of 50 without filters`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.list(any(), any(), any()) } returns emptyPage()

        client.get("/api/books")

        coVerify { books.list(PageRequest(PageNumber(1), PageSize(50)), null, BookFilters.NONE) }
    }

    @Test
    fun `list passes page and page size to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.list(any(), any(), any()) } returns emptyPage()

        client.get("/api/books?page=3&pageSize=10")

        coVerify { books.list(PageRequest(PageNumber(3), PageSize(10)), null, BookFilters.NONE) }
    }

    @Test
    fun `list response carries the items and the paging fields`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.list(any(), any(), any()) } returns Page(
            items = listOf(book("Dune"), book("Emma", types = listOf(BookTypes.PAPERBACK))),
            page = PageNumber(2),
            size = PageSize(10),
            totalItems = 25,
        )

        val response = client.get("/api/books?page=2&pageSize=10").decodeBody<PageResponse<BookResponse>>()

        assertEquals(listOf("Dune", "Emma"), response.items.map { it.title })
        assertEquals(listOf("Paperback"), response.items.last().types.map { it.label })
        assertEquals(2, response.page)
        assertEquals(10, response.pageSize)
        assertEquals(25, response.totalItems)
        assertEquals(3, response.totalPages)
    }

    @Test
    fun `list passes a trimmed search term to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.list(any(), any(), any()) } returns emptyPage()

        client.get("/api/books?search=%20dune%20")

        coVerify { books.list(PageRequest(PageNumber(1), PageSize(50)), SearchTerm("dune"), BookFilters.NONE) }
    }

    @Test
    fun `list passes every repeatable filter to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.list(any(), any(), any()) } returns emptyPage()

        client.get(
            "/api/books?typeIds=${SeededBookTypes.KINDLE}&typeIds=${SeededBookTypes.AUDIBLE}" +
                "&ownership=owned&progress=reading&progress=paused&releaseYear=1965&releaseYear=2001",
        )

        coVerify {
            books.list(
                PageRequest(PageNumber(1), PageSize(50)),
                null,
                BookFilters(
                    typeIds = setOf(
                        BookTypeId.parse(SeededBookTypes.KINDLE),
                        BookTypeId.parse(SeededBookTypes.AUDIBLE),
                    ),
                    ownership = setOf(BookOwnership.OWNED),
                    progress = setOf(BookProgress.READING, BookProgress.PAUSED),
                    releaseYears = setOf(ReleaseYear(1965), ReleaseYear(2001)),
                ),
            )
        }
    }

    @Test
    fun `list rejects ownership subscription`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.get("/api/books?ownership=subscription").assertValidationError("ownership")
        coVerify(exactly = 0) { books.list(any(), any(), any()) }
    }

    @Test
    fun `list rejects progress playing`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.get("/api/books?progress=playing").assertValidationError("progress")
        coVerify(exactly = 0) { books.list(any(), any(), any()) }
    }

    @Test
    fun `list rejects more than 50 values of one filter`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val years = (1..MAX_FILTER_VALUES + 1).joinToString("&") { "releaseYear=${1000 + it}" }

        client.get("/api/books?$years").assertValidationError("releaseYear")
        coVerify(exactly = 0) { books.list(any(), any(), any()) }
    }

    @Test
    fun `list rejects a malformed type id`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.get("/api/books?typeIds=nope").assertValidationError("typeIds")
    }

    @Test
    fun `list rejects page 0`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.get("/api/books?page=0").assertValidationError("page")
    }

    // ---- update ----

    private fun patchSlot(books: BookService, id: BookId): io.mockk.CapturingSlot<BookPatch> {
        val captured = slot<BookPatch>()
        coEvery { books.update(id, capture(captured)) } returns book("Dune", id = id)
        return captured
    }

    private suspend fun HttpClient.patchBook(id: BookId, body: String): HttpResponse =
        patch("/api/books/$id") { jsonBody(body) }

    @Test
    fun `patch with an empty body maps every field to unchanged`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        val response = client.patchBook(id, "{}")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals(BookPatch(), captured.captured)
    }

    @Test
    fun `patch maps explicit nulls to clear and values to set`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        client.patchBook(id, """{"description":null,"coverImageUrl":"https://img.example/n.png","releaseDate":null}""")

        assertEquals(Patch.Change(null), captured.captured.description)
        assertEquals(Patch.Change(CoverImageUrl("https://img.example/n.png")), captured.captured.coverImageUrl)
        assertEquals(Patch.Change(null), captured.captured.releaseDate)
    }

    @Test
    fun `patch maps a release date to set`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        client.patchBook(id, """{"releaseDate":"1965-08-01"}""")

        assertEquals(Patch.Change(ReleaseDate.parse("1965-08-01")), captured.captured.releaseDate)
    }

    @Test
    fun `patch maps empty type and author lists to cleared sets`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        client.patchBook(id, """{"typeIds":[],"authorIds":[]}""")

        assertEquals(emptySet(), captured.captured.typeIds)
        assertEquals(emptySet(), captured.captured.authorIds)
    }

    @Test
    fun `patch maps status fields and the title`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        client.patchBook(id, """{"title":"Dune Messiah","ownership":"owned","progress":"finished"}""")

        assertEquals(Title("Dune Messiah"), captured.captured.title)
        assertEquals(BookOwnership.OWNED, captured.captured.ownership)
        assertEquals(BookProgress.FINISHED, captured.captured.progress)
    }

    @Test
    fun `patch rejects progress completed`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.patchBook(BookId.new(), """{"progress":"completed"}""").assertValidationError("progress")
    }

    @Test
    fun `patch of an unknown book is 404`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        coEvery { books.update(id, any()) } throws NotFoundException("book", id.toString())

        client.patchBook(id, """{"title":"x"}""").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `patch with a malformed id is a 400`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.patch("/api/books/not-a-uuid") { jsonBody("{}") }.assertValidationError("id")
    }

    // ---- delete ----

    @Test
    fun `delete returns 204`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        coEvery { books.delete(id) } just Runs

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/books/$id").status)
        coVerify { books.delete(id) }
    }

    @Test
    fun `delete with a malformed id is a 400`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)

        client.delete("/api/books/not-a-uuid").assertValidationError("id")
    }

    // ---- types and meta ----

    @Test
    fun `book types lists id label and color`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.listTypes() } returns listOf(BookTypes.HARDCOVER, BookTypes.KINDLE)

        val types = client.get("/api/book-types").decodeBody<List<BookTypeResponse>>()

        assertEquals(listOf("Hardcover", "Kindle"), types.map { it.label })
        assertEquals(SeededBookTypes.HARDCOVER, types.first().id)
        assertEquals("1A73B5", types.last().associatedColor)
    }

    @Test
    fun `meta mirrors the domain meta in order`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        coEvery { books.meta() } returns BookMeta(
            types = listOf(BookTypes.KINDLE),
            ownership = listOf(BookOwnership.WATCHLIST, BookOwnership.OWNED),
            progress = listOf(BookProgress.NOT_STARTED, BookProgress.READING),
            releaseYears = listOf(ReleaseYear(2001), ReleaseYear(1965)),
        )

        val meta = client.get("/api/books.meta").decodeBody<BookMetaResponse>()

        assertEquals(listOf("Kindle"), meta.types.map { it.label })
        assertEquals(listOf("watchlist", "owned"), meta.ownership)
        assertEquals(listOf("not_started", "reading"), meta.progress)
        assertEquals(listOf(2001, 1965), meta.releaseYears)
    }

    // ---- authors ----

    @Test
    fun `author search passes the term and the default limit`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = loggedInClient(authors = authors)
        coEvery { authors.search(SearchTerm("fra"), VocabularySearchLimit.DEFAULT) } returns
            listOf(author("Frank Herbert"))

        val response = client.get("/api/book-authors?search=fra").decodeBody<List<BookAuthorResponse>>()

        assertEquals(listOf("Frank Herbert"), response.map { it.name })
        coVerify { authors.search(SearchTerm("fra"), VocabularySearchLimit.DEFAULT) }
    }

    @Test
    fun `author search passes an explicit limit and no term when absent`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = loggedInClient(authors = authors)
        coEvery { authors.search(null, VocabularySearchLimit(5)) } returns emptyList()

        client.get("/api/book-authors?limit=5")

        coVerify { authors.search(null, VocabularySearchLimit(5)) }
    }

    @Test
    fun `author search rejects a limit above the maximum`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = loggedInClient(authors = authors)

        client.get("/api/book-authors?limit=${VocabularySearchLimit.MAX + 1}").assertValidationError("limit")
    }

    @Test
    fun `creating a new author is 201`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = loggedInClient(authors = authors)
        val created = author("Frank Herbert")
        coEvery { authors.create(VocabularyName("Frank Herbert")) } returns VocabularyCreation(created, true)

        val response = client.post("/api/book-authors") { jsonBody("""{"name":"Frank Herbert"}""") }

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals(created.id.toString(), response.decodeBody<BookAuthorResponse>().id)
    }

    @Test
    fun `creating an existing author is 200`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = loggedInClient(authors = authors)
        coEvery { authors.create(any()) } returns VocabularyCreation(author("Frank Herbert"), false)

        val response = client.post("/api/book-authors") { jsonBody("""{"name":"frank herbert"}""") }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }

    @Test
    fun `creating an author with a blank name is a 400`() = testApplication {
        val authors = mockk<BookAuthorService>()
        val client = loggedInClient(authors = authors)

        client.post("/api/book-authors") { jsonBody("""{"name":"  "}""") }.assertValidationError("name")
        coVerify(exactly = 0) { authors.create(any()) }
    }

    // ---- narrators and series on books ----

    @Test
    fun `create response mirrors narrators and series with their positions`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val created = book(
            "The Final Empire",
            narrators = listOf(narrator("Michael Kramer")),
            series = listOf(seriesEntry(series("Mistborn"), 2.5), seriesEntry(series("The Cosmere"))),
        )
        coEvery { books.create(any()) } returns created

        val body = client.createBook("""{"title":"x","releaseYear":2006}""").bodyAsText()
        val response = Json.decodeFromString<BookResponse>(body)

        assertEquals(listOf("Michael Kramer"), response.narrators.map { it.name })
        assertEquals(listOf("Mistborn", "The Cosmere"), response.series.map { it.name })
        assertEquals(listOf(2.5, null), response.series.map { it.position })
        assertContains(body, "\"position\":null")
    }

    @Test
    fun `create hands narrator ids and series positions to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val captured = slot<NewBook>()
        coEvery { books.create(capture(captured)) } returns book("Dune")
        val narratorId = Uuid.random().toString()
        val withPosition = Uuid.random().toString()
        val withoutPosition = Uuid.random().toString()

        client.createBook(
            """{"title":"Dune","releaseYear":1965,"narratorIds":["$narratorId"],
                |"series":[{"seriesId":"$withPosition","position":2.5},{"seriesId":"$withoutPosition"}]}
            """.trimMargin(),
        )

        assertEquals(setOf(BookNarratorId.parse(narratorId)), captured.captured.narratorIds)
        assertEquals(
            mapOf(
                BookSeriesId.parse(withPosition) to BookSeriesPosition.fromDouble(2.5),
                BookSeriesId.parse(withoutPosition) to null,
            ),
            captured.captured.series,
        )
    }

    @Test
    fun `create without narrators and series hands empty collections to the service`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val captured = slot<NewBook>()
        coEvery { books.create(capture(captured)) } returns book("Dune")

        client.createBook("""{"title":"Dune","releaseYear":1965}""")

        assertEquals(emptySet(), captured.captured.narratorIds)
        assertEquals(emptyMap(), captured.captured.series)
    }

    @Test
    fun `create rejects a malformed narrator id`() = testApplication {
        val client = loggedInClient()

        client.createBook("""{"title":"x","releaseYear":1965,"narratorIds":["nope"]}""")
            .assertValidationError("narratorIds")
    }

    @Test
    fun `create rejects a malformed series id`() = testApplication {
        val client = loggedInClient()

        client.createBook("""{"title":"x","releaseYear":1965,"series":[{"seriesId":"nope"}]}""")
            .assertValidationError("series")
    }

    @Test
    fun `create rejects a duplicate series id`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = Uuid.random().toString()

        client.createBook(
            """{"title":"x","releaseYear":1965,"series":[{"seriesId":"$id","position":1},{"seriesId":"$id"}]}""",
        ).assertValidationError("series")
        coVerify(exactly = 0) { books.create(any()) }
    }

    @Test
    fun `create rejects invalid series positions`() = testApplication {
        val client = loggedInClient()
        val id = Uuid.random().toString()

        listOf("-1", "10000", "1.234").forEach { position ->
            client.createBook(
                """{"title":"x","releaseYear":1965,"series":[{"seriesId":"$id","position":$position}]}""",
            ).assertValidationError("series")
        }
    }

    @Test
    fun `patch maps empty narrator and series lists to cleared collections`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        client.patchBook(id, """{"narratorIds":[],"series":[]}""")

        assertEquals(emptySet(), captured.captured.narratorIds)
        assertEquals(emptyMap(), captured.captured.series)
    }

    @Test
    fun `patch without narrators and series leaves them unchanged`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)

        client.patchBook(id, "{}")

        assertNull(captured.captured.narratorIds)
        assertNull(captured.captured.series)
    }

    @Test
    fun `patch maps series with and without positions`() = testApplication {
        val books = mockk<BookService>()
        val client = loggedInClient(books)
        val id = BookId.new()
        val captured = patchSlot(books, id)
        val seriesId = Uuid.random().toString()

        client.patchBook(id, """{"series":[{"seriesId":"$seriesId","position":0}]}""")

        assertEquals(
            mapOf(BookSeriesId.parse(seriesId) to BookSeriesPosition.fromDouble(0.0)),
            captured.captured.series,
        )
    }

    @Test
    fun `patch rejects a duplicate series id`() = testApplication {
        val client = loggedInClient()
        val id = BookId.new()
        val seriesId = Uuid.random().toString()

        client.patchBook(id, """{"series":[{"seriesId":"$seriesId"},{"seriesId":"$seriesId"}]}""")
            .assertValidationError("series")
    }

    // ---- narrators ----

    @Test
    fun `narrator search passes the term and the default limit`() = testApplication {
        val narrators = mockk<BookNarratorService>()
        val client = loggedInClient(narrators = narrators)
        coEvery { narrators.search(SearchTerm("mic"), VocabularySearchLimit.DEFAULT) } returns
            listOf(narrator("Michael Kramer"))

        val response = client.get("/api/book-narrators?search=mic").decodeBody<List<BookNarratorResponse>>()

        assertEquals(listOf("Michael Kramer"), response.map { it.name })
    }

    @Test
    fun `narrator search rejects a limit above the maximum`() = testApplication {
        val client = loggedInClient(narrators = mockk<BookNarratorService>())

        client.get("/api/book-narrators?limit=${VocabularySearchLimit.MAX + 1}").assertValidationError("limit")
    }

    @Test
    fun `creating a new narrator is 201 and an existing one is 200`() = testApplication {
        val narrators = mockk<BookNarratorService>()
        val client = loggedInClient(narrators = narrators)
        val kramer = narrator("Michael Kramer")
        coEvery { narrators.create(VocabularyName("Michael Kramer")) } returns VocabularyCreation(kramer, true)
        coEvery { narrators.create(VocabularyName("michael kramer")) } returns VocabularyCreation(kramer, false)

        val created = client.post("/api/book-narrators") { jsonBody("""{"name":"Michael Kramer"}""") }
        val existing = client.post("/api/book-narrators") { jsonBody("""{"name":"michael kramer"}""") }

        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        assertEquals(kramer.id.toString(), created.decodeBody<BookNarratorResponse>().id)
        assertEquals(HttpStatusCode.OK, existing.status, existing.bodyAsText())
    }

    @Test
    fun `creating a narrator with a blank name is a 400`() = testApplication {
        val narrators = mockk<BookNarratorService>()
        val client = loggedInClient(narrators = narrators)

        client.post("/api/book-narrators") { jsonBody("""{"name":"  "}""") }.assertValidationError("name")
        coVerify(exactly = 0) { narrators.create(any()) }
    }

    // ---- series ----

    @Test
    fun `series search passes the term and the default limit`() = testApplication {
        val seriesService = mockk<BookSeriesService>()
        val client = loggedInClient(series = seriesService)
        coEvery { seriesService.search(SearchTerm("mist"), VocabularySearchLimit.DEFAULT) } returns
            listOf(series("Mistborn"))

        val response = client.get("/api/book-series?search=mist").decodeBody<List<BookSeriesResponse>>()

        assertEquals(listOf("Mistborn"), response.map { it.name })
    }

    @Test
    fun `series search passes an explicit limit and no term when absent`() = testApplication {
        val seriesService = mockk<BookSeriesService>()
        val client = loggedInClient(series = seriesService)
        coEvery { seriesService.search(null, VocabularySearchLimit(5)) } returns emptyList()

        client.get("/api/book-series?limit=5")

        coVerify { seriesService.search(null, VocabularySearchLimit(5)) }
    }

    @Test
    fun `series search rejects a limit above the maximum`() = testApplication {
        val client = loggedInClient(series = mockk<BookSeriesService>())

        client.get("/api/book-series?limit=${VocabularySearchLimit.MAX + 1}").assertValidationError("limit")
    }

    @Test
    fun `creating a new series is 201 and an existing one is 200`() = testApplication {
        val seriesService = mockk<BookSeriesService>()
        val client = loggedInClient(series = seriesService)
        val mistborn = series("Mistborn")
        coEvery { seriesService.create(VocabularyName("Mistborn")) } returns VocabularyCreation(mistborn, true)
        coEvery { seriesService.create(VocabularyName("mistborn")) } returns VocabularyCreation(mistborn, false)

        val created = client.post("/api/book-series") { jsonBody("""{"name":"Mistborn"}""") }
        val existing = client.post("/api/book-series") { jsonBody("""{"name":"mistborn"}""") }

        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        assertEquals(mistborn.id.toString(), created.decodeBody<BookSeriesResponse>().id)
        assertEquals(HttpStatusCode.OK, existing.status, existing.bodyAsText())
    }

    @Test
    fun `creating a series with a blank name is a 400`() = testApplication {
        val seriesService = mockk<BookSeriesService>()
        val client = loggedInClient(series = seriesService)

        client.post("/api/book-series") { jsonBody("""{"name":"  "}""") }.assertValidationError("name")
        coVerify(exactly = 0) { seriesService.create(any()) }
    }
}
