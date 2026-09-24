package de.sluit.mediatracker.games.integration

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.config.SteamGridDbConfig
import de.sluit.mediatracker.games.domain.COVER_PAGE_SIZE
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.CoverType
import de.sluit.mediatracker.games.domain.ReleaseYear
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import java.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Adapter-level tests for [SteamGridDbCoverSource]: this is the games domain's equivalent of a repository test,
 * exercised against [MockEngine] instead of a real SteamGridDB. Business behaviour (ranking, default terms) lives
 * in [de.sluit.mediatracker.games.domain.CoverOptionsServiceTest].
 */
class SteamGridDbCoverSourceTest {
    private val config = SteamGridDbConfig(apiKey = "secret-key", baseUrl = "https://sgdb.example/api/v2")

    private fun sourceWith(
        handler: MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ): SteamGridDbCoverSource {
        val client = HttpClient(MockEngine(handler)) {
            expectSuccess = false
            install(ContentNegotiation) {
                json(steamGridDbJson)
            }
        }
        return SteamGridDbCoverSource(client, config)
    }

    private fun MockRequestHandleScope.jsonResponse(status: HttpStatusCode, body: String): HttpResponseData =
        respond(content = body, status = status, headers = headersOf(HttpHeaders.ContentType, "application/json"))

    // ---- request shape ----

    @Test
    fun `search sends the bearer header and url-encodes the search term`() = runBlocking {
        var seenAuth: String? = null
        var seenPath: String? = null
        val source = sourceWith { request ->
            seenAuth = request.headers[HttpHeaders.Authorization]
            seenPath = request.url.encodedPath
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[]}""")
        }

        source.searchGames(SearchTerm("Hades II"))

        assertEquals("Bearer secret-key", seenAuth)
        assertTrue(seenPath!!.endsWith("/search/autocomplete/Hades%20II"), seenPath)
    }

    @Test
    fun `findCovers sends the fixed grid query parameters`() = runBlocking {
        var dimensions: String? = null
        var types: String? = null
        var nsfw: String? = null
        var humor: String? = null
        var page: String? = null
        var limit: String? = null
        val source = sourceWith { request ->
            dimensions = request.url.parameters["dimensions"]
            types = request.url.parameters["types"]
            nsfw = request.url.parameters["nsfw"]
            humor = request.url.parameters["humor"]
            page = request.url.parameters["page"]
            limit = request.url.parameters["limit"]
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[]}""")
        }

        source.findCovers(CoverSourceGameId(42), CoverType.STATIC, PageNumber.FIRST, PageSize(COVER_PAGE_SIZE))

        assertEquals("600x900,660x930", dimensions)
        assertEquals("static", types)
        assertEquals("false", nsfw)
        assertEquals("false", humor)
        assertEquals("0", page)
        assertEquals("50", limit)
    }

    @Test
    fun `findCovers sends types animated when requesting animated covers`() = runBlocking {
        var types: String? = null
        val source = sourceWith { request ->
            types = request.url.parameters["types"]
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[]}""")
        }

        source.findCovers(CoverSourceGameId(42), CoverType.ANIMATED, PageNumber.FIRST, PageSize(COVER_PAGE_SIZE))

        assertEquals("animated", types)
    }

    @Test
    fun `findCovers converts the 1-based page number to steamgriddb's 0-based page parameter`() = runBlocking {
        var page: String? = null
        var limit: String? = null
        val source = sourceWith { request ->
            page = request.url.parameters["page"]
            limit = request.url.parameters["limit"]
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[]}""")
        }

        source.findCovers(CoverSourceGameId(42), CoverType.STATIC, PageNumber(2), PageSize(COVER_PAGE_SIZE))

        assertEquals("1", page)
        assertEquals("50", limit)
    }

    @Test
    fun `findCovers sends the requested page size as the limit`() = runBlocking {
        var limit: String? = null
        val source = sourceWith { request ->
            limit = request.url.parameters["limit"]
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[]}""")
        }

        source.findCovers(CoverSourceGameId(42), CoverType.STATIC, PageNumber.FIRST, PageSize(1))

        assertEquals("1", limit)
    }

    // ---- envelope paging mapping ----

    @Test
    fun `findCovers maps the envelope total and limit into the returned page`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[],"page":0,"total":120,"limit":50}""")
        }

        val covers = source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber(1), PageSize(COVER_PAGE_SIZE))

        assertEquals(120L, covers.totalItems)
        assertEquals(3, covers.totalPages)
        assertEquals(PageNumber(1), covers.page)
    }

    @Test
    fun `findCovers falls back to the item count and requested page size when total and limit are absent`() =
        runBlocking {
            val source = sourceWith {
                jsonResponse(
                    HttpStatusCode.OK,
                    """{"success":true,"data":[
                        |{"url":"https://cdn.example/full-1.png","thumb":"https://cdn.example/thumb-1.png",
                        |"width":600,"height":900},
                        |{"url":"https://cdn.example/full-2.png","thumb":"https://cdn.example/thumb-2.png",
                        |"width":600,"height":900}
                        |]}
                    """.trimMargin(),
                )
            }

            val covers = source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST, PageSize(30))

            assertEquals(2L, covers.totalItems)
            assertEquals(30, covers.size.value)
        }

    @Test
    fun `findCovers falls back to a monotone total on page 2 when total is absent`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"success":true,"data":[
                    |{"url":"https://cdn.example/full-1.png","thumb":"https://cdn.example/thumb-1.png",
                    |"width":600,"height":900},
                    |{"url":"https://cdn.example/full-2.png","thumb":"https://cdn.example/thumb-2.png",
                    |"width":600,"height":900}
                    |],"limit":50}
                """.trimMargin(),
            )
        }

        val covers = source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber(2), PageSize(COVER_PAGE_SIZE))

        assertEquals(52L, covers.totalItems)
    }

    @Test
    fun `findCovers falls back to the requested page size when the envelope limit is zero`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[],"limit":0}""")
        }

        val covers = source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST, PageSize(30))

        assertEquals(30, covers.size.value)
    }

    @Test
    fun `findCovers falls back to the requested page size when the envelope limit is too large`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[],"limit":100000}""")
        }

        val covers = source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST, PageSize(30))

        assertEquals(30, covers.size.value)
    }

    // ---- release year mapping ----

    @Test
    fun `search maps a present release_date to its utc year`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"success":true,"data":[{"id":1,"name":"Hades","verified":true,"release_date":1608076800}]}""",
            )
        }

        val candidates = source.searchGames(SearchTerm("Hades"))

        assertEquals(ReleaseYear(2020), candidates.single().releaseYear)
    }

    @Test
    fun `search maps an absent release_date to a null year`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.OK, """{"success":true,"data":[{"id":1,"name":"Hades"}]}""")
        }

        val candidates = source.searchGames(SearchTerm("Hades"))

        assertNull(candidates.single().releaseYear)
    }

    // ---- grids not found ----

    @Test
    fun `findCovers on a 404 with success false returns an empty page`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.NotFound, """{"success":false,"errors":["Game not found"]}""")
        }

        val covers = source.findCovers(
            CoverSourceGameId(1),
            CoverType.STATIC,
            PageNumber.FIRST,
            PageSize(COVER_PAGE_SIZE),
        )

        assertEquals(emptyList(), covers.items)
        assertEquals(0, covers.totalItems)
    }

    @Test
    fun `findCovers on a 404 returns an empty page carrying the requested page size`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.NotFound, """{"success":false,"errors":["Game not found"]}""")
        }

        val covers = source.findCovers(CoverSourceGameId(1), CoverType.STATIC, PageNumber.FIRST, PageSize(1))

        assertEquals(1, covers.size.value)
    }

    // ---- invalid candidate ids ----

    @Test
    fun `search skips a game with a non-positive id and keeps the others`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"success":true,"data":[{"id":0,"name":"Bad"},{"id":1,"name":"Hades"}]}""",
            )
        }

        val candidates = source.searchGames(SearchTerm("Hades"))

        assertEquals(1, candidates.size)
        assertEquals("Hades", candidates.single().name)
    }

    // ---- upstream failures ----

    @Test
    fun `search on a 401 response throws an external source exception`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.Unauthorized, """{"success":false,"errors":["Invalid API Key"]}""")
        }

        val exception = assertFailsWith<ExternalSourceException> {
            source.searchGames(SearchTerm("Hades"))
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
        assertFalse(exception.message!!.contains("secret-key"))
    }

    @Test
    fun `search on a 403 response throws an external source exception`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.Forbidden, """{"success":false,"errors":["Forbidden"]}""")
        }

        val exception = assertFailsWith<ExternalSourceException> {
            source.searchGames(SearchTerm("Hades"))
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
    }

    @Test
    fun `search on a 500 response with a success true envelope still throws an external source exception`() =
        runBlocking {
            val source = sourceWith {
                jsonResponse(HttpStatusCode.InternalServerError, """{"success":true,"data":[]}""")
            }

            val exception = assertFailsWith<ExternalSourceException> {
                source.searchGames(SearchTerm("Hades"))
            }

            assertEquals(CoverOptionsService.SOURCE, exception.source)
        }

    @Test
    fun `search on a 500 response throws an external source exception`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.InternalServerError, "Internal Server Error")
        }

        val exception = assertFailsWith<ExternalSourceException> {
            source.searchGames(SearchTerm("Hades"))
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
    }

    @Test
    fun `search with a success false envelope on an otherwise ok status throws an external source exception`() =
        runBlocking {
            val source = sourceWith {
                jsonResponse(HttpStatusCode.OK, """{"success":false,"errors":["nope"]}""")
            }

            val exception = assertFailsWith<ExternalSourceException> {
                source.searchGames(SearchTerm("Hades"))
            }

            assertEquals(CoverOptionsService.SOURCE, exception.source)
        }

    @Test
    fun `search with a malformed json body throws an external source exception`() = runBlocking {
        val source = sourceWith {
            jsonResponse(HttpStatusCode.OK, "not json at all")
        }

        val exception = assertFailsWith<ExternalSourceException> {
            source.searchGames(SearchTerm("Hades"))
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
    }

    @Test
    fun `search wraps an io exception thrown while talking to the upstream`() = runBlocking {
        val source = sourceWith {
            throw IOException("connection reset")
        }

        val exception = assertFailsWith<ExternalSourceException> {
            source.searchGames(SearchTerm("Hades"))
        }

        assertEquals(CoverOptionsService.SOURCE, exception.source)
    }

    // ---- invalid grid urls ----

    @Test
    fun `findCovers skips a grid with an invalid url`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"success":true,"data":[
                    |{"url":"not-a-url","thumb":"https://cdn.example/thumb-bad.png","width":600,"height":900},
                    |{"url":"https://cdn.example/full-good.png","thumb":"https://cdn.example/thumb-good.png",
                    |"width":600,"height":900}
                    |]}
                """.trimMargin(),
            )
        }

        val covers = source.findCovers(
            CoverSourceGameId(1),
            CoverType.STATIC,
            PageNumber.FIRST,
            PageSize(COVER_PAGE_SIZE),
        )

        assertEquals(1, covers.items.size)
        assertEquals("https://cdn.example/full-good.png", covers.items.single().imageUrl.value)
    }
}
