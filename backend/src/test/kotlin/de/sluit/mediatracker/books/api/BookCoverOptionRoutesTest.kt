package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.books.domain.BookCoverOptions
import de.sluit.mediatracker.books.domain.BookCoverOptionsService
import de.sluit.mediatracker.books.domain.BookCoverSourceKind
import de.sluit.mediatracker.books.domain.BookTitleSuggestion
import de.sluit.mediatracker.books.domain.BookWork
import de.sluit.mediatracker.books.domain.BookWorkId
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.CoverOption
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.mockk.Called
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Handler tests for `/api/books/cover-options` and `/api/books/title-suggestions`: real plugins and routes through
 * [handlerApp], [BookCoverOptionsService] is a strict MockK mock. They pin the HTTP contract mirrored in
 * `frontend/src/types/api.ts` and the domain values the handler hands to the service.
 */
class BookCoverOptionRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(service: BookCoverOptionsService): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth, bookCoverOptions = service)
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    private fun cover(n: Int = 1) = CoverOption(
        thumbnailUrl = CoverImageUrl("https://example.org/thumb-$n.jpg"),
        imageUrl = CoverImageUrl("https://example.org/full-$n.jpg"),
        width = null,
        height = null,
    )

    private fun options(
        source: BookCoverSourceKind = BookCoverSourceKind.BOOK,
        matches: List<BookWork> = emptyList(),
        selected: BookWorkId? = null,
        covers: List<CoverOption> = emptyList(),
    ) = BookCoverOptions(
        query = SearchTerm("Hobbit"),
        source = source,
        matches = matches,
        selectedMatch = selected,
        covers = Page(covers, PageNumber.FIRST, PageSize(50), covers.size.toLong()),
    )

    private val hobbit = BookWork(BookWorkId("OL27482W"), "The Hobbit", listOf("J.R.R. Tolkien"), ReleaseYear(1937))

    // ---- cover-options ----

    @Test
    fun `cover options answer the full shape with matches and covers`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("Hobbit"), null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)
        } returns options(matches = listOf(hobbit), selected = hobbit.id, covers = listOf(cover(1)))

        val response = client.get("/api/books/cover-options?query=Hobbit").decodeBody<BookCoverOptionsResponse>()

        assertEquals("Hobbit", response.query)
        assertEquals("book", response.source)
        assertEquals("OL27482W", response.selectedMatchId)
        assertEquals(
            BookCoverMatchResponse("OL27482W", "The Hobbit", listOf("J.R.R. Tolkien"), 1937),
            response.matches.single(),
        )
        assertEquals("https://example.org/thumb-1.jpg", response.covers.items.single().thumbnailUrl)
        assertEquals("https://example.org/full-1.jpg", response.covers.items.single().imageUrl)
        assertEquals(1L, response.covers.totalItems)
    }

    @Test
    fun `cover options answer an explicit null selectedMatchId when nothing matched`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("Hobbit"), null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)
        } returns options()

        val response = client.get("/api/books/cover-options?query=Hobbit")

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"selectedMatchId\":null"), response.bodyAsText())
    }

    @Test
    fun `source match release year and page reach the service`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(
                SearchTerm("Hobbit"),
                ReleaseYear(1937),
                BookCoverSourceKind.BOOK,
                BookWorkId("OL27482W"),
                PageNumber(3),
            )
        } returns options()

        client.get("/api/books/cover-options?query=Hobbit&releaseYear=1937&source=book&match=OL27482W&page=3")

        coVerify {
            service.find(
                SearchTerm("Hobbit"),
                ReleaseYear(1937),
                BookCoverSourceKind.BOOK,
                BookWorkId("OL27482W"),
                PageNumber(3),
            )
        }
    }

    @Test
    fun `the audiobook source reaches the service and is echoed`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("Hobbit"), null, BookCoverSourceKind.AUDIOBOOK, null, PageNumber.FIRST)
        } returns options(source = BookCoverSourceKind.AUDIOBOOK, covers = listOf(cover(1), cover(2)))

        val response = client.get("/api/books/cover-options?query=Hobbit&source=audiobook")
            .decodeBody<BookCoverOptionsResponse>()

        assertEquals("audiobook", response.source)
        assertEquals(emptyList(), response.matches)
        assertEquals(2, response.covers.items.size)
    }

    @Test
    fun `blank source match and release year reach the service as defaults`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("Hobbit"), null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)
        } returns options()

        client.get("/api/books/cover-options?query=Hobbit&source=%20&match=&releaseYear=%20")

        coVerify { service.find(SearchTerm("Hobbit"), null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST) }
    }

    @Test
    fun `a missing query is 400 validation_error naming the field`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)

        val error = client.get("/api/books/cover-options").assertError(HttpStatusCode.BadRequest, "validation_error")

        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { service wasNot Called }
    }

    @Test
    fun `an unknown source is 400 validation_error naming the field`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)

        val error = client.get("/api/books/cover-options?query=x&source=ebook")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        assertTrue(error.message!!.startsWith("source"), error.message)
        coVerify { service wasNot Called }
    }

    @Test
    fun `a malformed match is 400 validation_error naming the field`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)

        val error = client.get("/api/books/cover-options?query=x&match=123")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        assertTrue(error.message!!.startsWith("match"), error.message)
        coVerify { service wasNot Called }
    }

    @Test
    fun `a page below 1 is 400 validation_error`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)

        client.get("/api/books/cover-options?query=x&page=0").assertError(HttpStatusCode.BadRequest, "validation_error")

        coVerify { service wasNot Called }
    }

    @Test
    fun `a domain rejection such as audiobook with match is 400 validation_error`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("x"), null, BookCoverSourceKind.AUDIOBOOK, BookWorkId("OL1W"), PageNumber.FIRST)
        } throws InvalidValueException("match", "is not supported for audiobooks")

        client.get("/api/books/cover-options?query=x&source=audiobook&match=OL1W")
            .assertError(HttpStatusCode.BadRequest, "validation_error")
    }

    @Test
    fun `an open library failure is 502 open_library_error`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("x"), null, BookCoverSourceKind.BOOK, null, PageNumber.FIRST)
        } throws ExternalSourceException("open_library", "boom")

        client.get("/api/books/cover-options?query=x").assertError(HttpStatusCode.BadGateway, "open_library_error")
    }

    @Test
    fun `an audible failure is 502 audible_error`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery {
            service.find(SearchTerm("x"), null, BookCoverSourceKind.AUDIOBOOK, null, PageNumber.FIRST)
        } throws ExternalSourceException("audible", "boom")

        client.get("/api/books/cover-options?query=x&source=audiobook")
            .assertError(HttpStatusCode.BadGateway, "audible_error")
    }

    @Test
    fun `cover options without a session are 401`() = testApplication {
        val client = handlerApp()

        val response = client.get("/api/books/cover-options?query=x")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    // ---- title-suggestions ----

    @Test
    fun `title suggestions answer the suggestions with their source`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery { service.suggestTitles(SearchTerm("Hobbit"), BookCoverSourceKind.AUDIOBOOK) } returns
            listOf(
                BookTitleSuggestion(
                    "Der Hobbit",
                    listOf("J.R.R. Tolkien"),
                    listOf("Rufus Beck"),
                    ReleaseYear(2011),
                    BookCoverSourceKind.AUDIOBOOK,
                ),
            )

        val response = client.get("/api/books/title-suggestions?query=Hobbit&source=audiobook")
            .decodeBody<BookTitleSuggestionsResponse>()

        assertEquals(
            BookTitleSuggestionResponse(
                "Der Hobbit",
                listOf("J.R.R. Tolkien"),
                listOf("Rufus Beck"),
                2011,
                "audiobook",
            ),
            response.suggestions.single(),
        )
    }

    @Test
    fun `title suggestions default to the book source`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)
        coEvery { service.suggestTitles(SearchTerm("Hobbit"), BookCoverSourceKind.BOOK) } returns emptyList()

        val response = client.get("/api/books/title-suggestions?query=Hobbit")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(emptyList(), response.decodeBody<BookTitleSuggestionsResponse>().suggestions)
    }

    @Test
    fun `title suggestions with an unknown source are 400 validation_error`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)

        val error = client.get("/api/books/title-suggestions?query=x&source=ebook")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        assertTrue(error.message!!.startsWith("source"), error.message)
        coVerify { service wasNot Called }
    }

    @Test
    fun `title suggestions without a session are 401`() = testApplication {
        val client = handlerApp()

        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/books/title-suggestions?query=x").status)
    }

    @Test
    fun `title suggestions without a query are 400 validation_error`() = testApplication {
        val service = mockk<BookCoverOptionsService>()
        val client = loggedInClient(service)

        client.get("/api/books/title-suggestions").assertError(HttpStatusCode.BadRequest, "validation_error")

        coVerify { service wasNot Called }
    }
}
