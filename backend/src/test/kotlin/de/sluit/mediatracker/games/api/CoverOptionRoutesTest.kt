package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.domain.CoverCandidate
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.CoverOption
import de.sluit.mediatracker.games.domain.CoverOptions
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.CoverType
import de.sluit.mediatracker.games.domain.ReleaseYear
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
 * Handler tests for `/api/games/cover-options`: real plugins and routes through [handlerApp],
 * [CoverOptionsService] is a MockK mock (strict), sessions live in memory, no database and no SteamGridDB call
 * happen. They pin the HTTP contract mirrored in `frontend/src/types/api.ts` and the exact domain values the
 * handler hands to the service; business behaviour lives in `CoverOptionsServiceTest` and the adapter's
 * `SteamGridDbCoverSourceTest`.
 *
 * The "not called at all" assertions below use `coVerify { coverOptions wasNot Called }` rather than
 * `coVerify(exactly = 0) { coverOptions.find(any(), any(), any(), any(), any()) }`: `any()`'s witness generation
 * for a value class always constructs a real instance (`JvmSignatureValueGenerator`), and for a `Long`-backed
 * value class that can be negative about half the time, which trips [CoverSourceGameId]'s `value > 0` check.
 */
class CoverOptionRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInHandlerClient(coverOptions: CoverOptionsService): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth, coverOptions = coverOptions)
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    private fun candidate(id: Long, name: String) =
        CoverCandidate(id = CoverSourceGameId(id), name = name, releaseYear = null, verified = true)

    private fun cover(n: Int = 1) = CoverOption(
        thumbnailUrl = CoverImageUrl("https://example.org/thumb-$n.png"),
        imageUrl = CoverImageUrl("https://example.org/full-$n.png"),
        width = 600,
        height = 900,
    )

    private fun emptyCoverPage() = Page<CoverOption>(emptyList(), PageNumber.FIRST, PageSize(50), 0)

    // ---- happy path ----

    @Test
    fun `answers 200 with an explicit null selectedMatchId when nothing was found`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        val response = client.get("/api/games/cover-options?query=Hades")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertTrue(response.bodyAsText().contains("\"selectedMatchId\":null"), response.bodyAsText())
    }

    @Test
    fun `answers 200 with the full shape when a match and covers are found`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = listOf(candidate(1, "Hades"), candidate(2, "Hades II")),
                selectedMatchId = CoverSourceGameId(1),
                type = CoverType.STATIC,
                covers = Page(listOf(cover(1)), PageNumber.FIRST, PageSize(50), 1),
            )

        val response = client.get("/api/games/cover-options?query=Hades").decodeBody<CoverOptionsResponse>()

        assertEquals("Hades", response.query)
        assertEquals(listOf(1L, 2L), response.matches.map { it.id })
        assertEquals(listOf("Hades", "Hades II"), response.matches.map { it.name })
        assertEquals(1L, response.selectedMatchId)
        assertEquals("static", response.type)
        assertEquals(1, response.covers.items.size)
        assertEquals("https://example.org/thumb-1.png", response.covers.items.single().thumbnailUrl)
        assertEquals("https://example.org/full-1.png", response.covers.items.single().imageUrl)
    }

    // ---- query parameter mapping ----

    @Test
    fun `passes the parsed query and match to the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery {
            coverOptions.find(SearchTerm("zelda"), null, CoverSourceGameId(5), CoverType.STATIC, PageNumber.FIRST)
        } returns
            CoverOptions(
                query = SearchTerm("zelda"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=zelda&match=5")

        coVerify {
            coverOptions.find(SearchTerm("zelda"), null, CoverSourceGameId(5), CoverType.STATIC, PageNumber.FIRST)
        }
    }

    @Test
    fun `a release year reaches the service as a ReleaseYear`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery {
            coverOptions.find(SearchTerm("Hades"), ReleaseYear(2020), null, CoverType.STATIC, PageNumber.FIRST)
        } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=Hades&releaseYear=2020")

        coVerify {
            coverOptions.find(SearchTerm("Hades"), ReleaseYear(2020), null, CoverType.STATIC, PageNumber.FIRST)
        }
    }

    @Test
    fun `a blank release year reaches the service as null`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=Hades&releaseYear=%20%20")

        coVerify { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) }
    }

    @Test
    fun `absent query parameters reach the service as their defaults`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=game")

        coVerify { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) }
    }

    @Test
    fun `an empty match reaches the service as a null match`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=game&match=")

        coVerify { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) }
    }

    @Test
    fun `an explicit type and page reach the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("game"), null, null, CoverType.ANIMATED, PageNumber(3)) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.ANIMATED,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=game&type=animated&page=3")

        coVerify { coverOptions.find(SearchTerm("game"), null, null, CoverType.ANIMATED, PageNumber(3)) }
    }

    @Test
    fun `a blank type reaches the service as the default type`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=game&type=%20%20")

        coVerify { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) }
    }

    @Test
    fun `a pageSize query parameter is ignored`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        client.get("/api/games/cover-options?query=game&pageSize=5")

        coVerify { coverOptions.find(SearchTerm("game"), null, null, CoverType.STATIC, PageNumber.FIRST) }
    }

    @Test
    fun `the 200 body carries the cover type and the covers page shape`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = Page(listOf(cover(1)), PageNumber.FIRST, PageSize(50), 1),
            )

        val response = client.get("/api/games/cover-options?query=Hades").decodeBody<CoverOptionsResponse>()

        assertEquals("static", response.type)
        assertEquals(1, response.covers.items.size)
        assertEquals(1, response.covers.page)
        assertEquals(50, response.covers.pageSize)
        assertEquals(1L, response.covers.totalItems)
        assertEquals(1, response.covers.totalPages)
    }

    // ---- validation ----

    @Test
    fun `a missing query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a blank query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=%20%20")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a non-numeric release year is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&releaseYear=abc")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(ReleaseYear.FIELD), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `an out-of-range release year is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&releaseYear=999")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(ReleaseYear.FIELD), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a non-numeric match is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&match=abc")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("match"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a zero match is 400 validation_error`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&match=0")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("match"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `an unknown type is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&type=gif")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(CoverType.FIELD), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a zero page is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&page=0")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(PageNumber.FIELD), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a non-numeric page is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/cover-options?query=Hades&page=x")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(PageNumber.FIELD), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a 201-character query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val tooLong = "a".repeat(201)

        val response = client.get("/api/games/cover-options?query=$tooLong")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `the cover-options path is not treated as a game id`() = testApplication {
        // Ktor gives a constant path segment a higher routing quality than a parameter, so declaration order
        // does not matter here.
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("x"), null, null, CoverType.STATIC, PageNumber.FIRST) } returns
            CoverOptions(
                query = SearchTerm("x"),
                matches = emptyList(),
                selectedMatchId = null,
                type = CoverType.STATIC,
                covers = emptyCoverPage(),
            )

        val response = client.get("/api/games/cover-options?query=x")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify { coverOptions.find(SearchTerm("x"), null, null, CoverType.STATIC, PageNumber.FIRST) }
    }

    // ---- error mapping ----

    @Test
    fun `an unconfigured source is 503 cover_source_unavailable`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) } throws
            ExternalSourceUnavailableException(CoverOptionsService.SOURCE)

        client.get("/api/games/cover-options?query=Hades")
            .assertError(HttpStatusCode.ServiceUnavailable, "cover_source_unavailable")
    }

    @Test
    fun `an upstream failure is 502 cover_source_error`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.find(SearchTerm("Hades"), null, null, CoverType.STATIC, PageNumber.FIRST) } throws
            ExternalSourceException(CoverOptionsService.SOURCE, "upstream boom")

        client.get("/api/games/cover-options?query=Hades")
            .assertError(HttpStatusCode.BadGateway, "cover_source_error")
    }

    // ---- authentication ----

    @Test
    fun `an anonymous request is a json 401 without reaching the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = handlerApp(coverOptions = coverOptions)

        client.get("/api/games/cover-options?query=Hades")
            .assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify { coverOptions wasNot Called }
    }

    // ---- title-suggestions ----

    @Test
    fun `title-suggestions answers 200 with the suggestion shape including a null releaseYear`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.suggestTitles(SearchTerm("Hades")) } returns
            listOf(candidate(1, "Hades"), candidate(2, "Hades II"))

        val response = client.get("/api/games/title-suggestions?query=Hades")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertTrue(response.bodyAsText().contains("\"releaseYear\":null"), response.bodyAsText())
        val body = response.decodeBody<TitleSuggestionsResponse>()
        assertEquals(listOf(1L, 2L), body.suggestions.map { it.id })
        assertEquals(listOf("Hades", "Hades II"), body.suggestions.map { it.name })
    }

    @Test
    fun `title-suggestions passes the trimmed query to the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        coEvery { coverOptions.suggestTitles(SearchTerm("zelda")) } returns emptyList()

        client.get("/api/games/title-suggestions?query=%20zelda%20")

        coVerify { coverOptions.suggestTitles(SearchTerm("zelda")) }
    }

    @Test
    fun `title-suggestions with a missing query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/title-suggestions")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `title-suggestions with a blank query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/title-suggestions?query=%20%20")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `title-suggestions with a 201-character query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val tooLong = "a".repeat(201)

        val response = client.get("/api/games/title-suggestions?query=$tooLong")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `title-suggestions for an anonymous request is a json 401 without reaching the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = handlerApp(coverOptions = coverOptions)

        client.get("/api/games/title-suggestions?query=Hades")
            .assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify { coverOptions wasNot Called }
    }
}
