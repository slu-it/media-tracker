package de.sluit.mediatracker.books.integration

import de.sluit.mediatracker.books.domain.BookWorkId
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.config.OpenLibraryConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.Url
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import java.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Adapter-level tests for [OpenLibraryWorkSource] against [MockEngine]; ranking lives in the domain tests. */
class OpenLibraryWorkSourceTest {
    private val config = OpenLibraryConfig(
        baseUrl = "https://ol.example",
        coversBaseUrl = "https://covers.example",
        userAgent = "test-agent (unit)",
    )
    private val work = BookWorkId("OL27482W")

    private fun sourceWith(handler: MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        OpenLibraryWorkSource(
            HttpClient(MockEngine(handler)) {
                expectSuccess = false
                install(ContentNegotiation) { json(openLibraryJson) }
            },
            config,
        )

    private fun MockRequestHandleScope.jsonResponse(status: HttpStatusCode, body: String) =
        respond(content = body, status = status, headers = headersOf(HttpHeaders.ContentType, "application/json"))

    private fun MockRequestHandleScope.workAndEditions(
        request: HttpRequestData,
        workBody: String,
        editionsBody: String,
    ) = if (request.url.encodedPath.endsWith("/editions.json")) {
        jsonResponse(HttpStatusCode.OK, editionsBody)
    } else {
        jsonResponse(HttpStatusCode.OK, workBody)
    }

    // ---- search ----

    @Test
    fun `search sends the query fields limit and user agent`() = runBlocking {
        var url: Url? = null
        var agent: String? = null
        val source = sourceWith { request ->
            url = request.url
            agent = request.headers[HttpHeaders.UserAgent]
            jsonResponse(HttpStatusCode.OK, """{"docs":[]}""")
        }

        source.searchWorks(SearchTerm("Der Hobbit"))

        assertEquals("/search.json", url!!.encodedPath)
        assertEquals("Der Hobbit", url.parameters["q"])
        assertEquals("key,title,author_name,first_publish_year,cover_i", url.parameters["fields"])
        assertEquals("20", url.parameters["limit"])
        assertEquals("test-agent (unit)", agent)
    }

    @Test
    fun `search maps docs to works and skips unusable ones`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"docs":[
                    {"key":"/works/OL27482W","title":"The Hobbit","author_name":["J.R.R. Tolkien"],"first_publish_year":1937,"cover_i":123},
                    {"key":"/works/OL1W","title":"No Author"},
                    {"key":"/authors/OL1A","title":"Wrong Key"},
                    {"key":"/works/OL2W"},
                    {"title":"No Key"},
                    {"key":"/works/OL3W","title":"Bad Year","first_publish_year":12}
                ]}""",
            )
        }

        val works = source.searchWorks(SearchTerm("hobbit"))

        assertEquals(listOf("OL27482W", "OL1W", "OL3W"), works.map { it.id.value })
        assertEquals("The Hobbit", works[0].name)
        assertEquals(listOf("J.R.R. Tolkien"), works[0].authors)
        assertEquals(ReleaseYear(1937), works[0].releaseYear)
        assertEquals(emptyList(), works[1].authors)
        assertNull(works[2].releaseYear)
        assertEquals(listOf(true, false, false), works.map { it.hasCover })
    }

    @Test
    fun `search turns a non-2xx response into an external source exception`() {
        val source = sourceWith { jsonResponse(HttpStatusCode.InternalServerError, "{}") }

        val e = assertFailsWith<ExternalSourceException> { runBlocking { source.searchWorks(SearchTerm("x")) } }

        assertEquals("open_library", e.source)
    }

    @Test
    fun `search turns a malformed body into an external source exception`() {
        val source = sourceWith { jsonResponse(HttpStatusCode.OK, "not json") }

        val e = assertFailsWith<ExternalSourceException> { runBlocking { source.searchWorks(SearchTerm("x")) } }

        assertEquals("open_library", e.source)
    }

    @Test
    fun `search turns an io failure into an external source exception`() {
        val source = sourceWith { throw IOException("connection refused") }

        val e = assertFailsWith<ExternalSourceException> { runBlocking { source.searchWorks(SearchTerm("x")) } }

        assertEquals("open_library", e.source)
    }

    // ---- covers ----

    @Test
    fun `covers merge work and edition covers dedupe and drop non-positive ids`() = runBlocking {
        val source = sourceWith { request ->
            workAndEditions(
                request,
                workBody = """{"covers":[-1,10,11]}""",
                editionsBody = """{"size":3,"entries":[{"covers":[11,12]},{},{"covers":[-1,13]}]}""",
            )
        }

        val page = source.findWorkCovers(work, PageNumber.FIRST, PageSize(50))

        assertEquals(4, page.totalItems)
        assertEquals(
            listOf("https://covers.example/b/id/10-L.jpg", "https://covers.example/b/id/11-L.jpg") +
                listOf("https://covers.example/b/id/12-L.jpg", "https://covers.example/b/id/13-L.jpg"),
            page.items.map { it.imageUrl.value },
        )
        assertEquals("https://covers.example/b/id/10-M.jpg", page.items.first().thumbnailUrl.value)
        assertNull(page.items.first().width)
        assertNull(page.items.first().height)
    }

    @Test
    fun `covers are paged in memory with an exact total`() = runBlocking {
        val source = sourceWith { request ->
            workAndEditions(request, """{"covers":[1,2,3]}""", """{"entries":[{"covers":[4,5]}]}""")
        }

        val second = source.findWorkCovers(work, PageNumber(2), PageSize(2))
        val third = source.findWorkCovers(work, PageNumber(3), PageSize(2))
        val fourth = source.findWorkCovers(work, PageNumber(4), PageSize(2))

        assertEquals(5, second.totalItems)
        assertEquals(
            listOf("3", "4"),
            second.items.map {
                it.imageUrl.value.substringAfter("/id/").substringBefore("-")
            },
        )
        assertEquals(1, third.items.size)
        assertTrue(fourth.items.isEmpty())
        assertEquals(5, fourth.totalItems)
    }

    @Test
    fun `a huge page number is an empty page instead of overflowing`() = runBlocking {
        val source = sourceWith { request -> workAndEditions(request, """{"covers":[1,2,3]}""", """{"entries":[]}""") }

        val page = source.findWorkCovers(work, PageNumber(Int.MAX_VALUE), PageSize(50))

        assertTrue(page.items.isEmpty())
        assertEquals(3, page.totalItems)
    }

    @Test
    fun `covers request the work and one editions call with limit 1000`() = runBlocking {
        val seen = mutableListOf<Pair<String, String?>>()
        var agent: String? = null
        val source = sourceWith { request ->
            seen += request.url.encodedPath to request.url.parameters["limit"]
            agent = request.headers[HttpHeaders.UserAgent]
            workAndEditions(request, """{}""", """{"entries":[]}""")
        }

        source.findWorkCovers(work, PageNumber.FIRST, PageSize(50))

        assertEquals(listOf("/works/OL27482W.json" to null, "/works/OL27482W/editions.json" to "1000"), seen)
        assertEquals("test-agent (unit)", agent)
    }

    @Test
    fun `an unknown work is an empty page`() = runBlocking {
        val source = sourceWith { jsonResponse(HttpStatusCode.NotFound, "{}") }

        val page = source.findWorkCovers(work, PageNumber.FIRST, PageSize(50))

        assertTrue(page.items.isEmpty())
        assertEquals(0, page.totalItems)
    }

    @Test
    fun `a failing editions call is an external source exception`() {
        val source = sourceWith { request ->
            if (request.url.encodedPath.endsWith("/editions.json")) {
                jsonResponse(HttpStatusCode.InternalServerError, "{}")
            } else {
                jsonResponse(HttpStatusCode.OK, """{"covers":[1]}""")
            }
        }

        val e = assertFailsWith<ExternalSourceException> {
            runBlocking { source.findWorkCovers(work, PageNumber.FIRST, PageSize(50)) }
        }

        assertEquals("open_library", e.source)
    }

    @Test
    fun `a failing work call is an external source exception`() {
        val source = sourceWith { jsonResponse(HttpStatusCode.BadGateway, "{}") }

        assertFailsWith<ExternalSourceException> {
            runBlocking { source.findWorkCovers(work, PageNumber.FIRST, PageSize(50)) }
        }
    }
}
