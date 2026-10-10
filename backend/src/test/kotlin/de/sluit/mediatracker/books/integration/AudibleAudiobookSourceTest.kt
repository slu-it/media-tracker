package de.sluit.mediatracker.books.integration

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.config.AudibleConfig
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

/** Adapter-level tests for [AudibleAudiobookSource] against [MockEngine]. */
class AudibleAudiobookSourceTest {
    private val config = AudibleConfig(marketplace = "de", baseUrl = "https://audible.example")

    private fun sourceWith(handler: MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        AudibleAudiobookSource(
            HttpClient(MockEngine(handler)) {
                expectSuccess = false
                install(ContentNegotiation) { json(audibleJson) }
            },
            config,
        )

    private fun MockRequestHandleScope.jsonResponse(status: HttpStatusCode, body: String) =
        respond(content = body, status = status, headers = headersOf(HttpHeaders.ContentType, "application/json"))

    @Test
    fun `search sends the catalog query and translates the page to 0-based`() = runBlocking {
        var url: Url? = null
        val source = sourceWith { request ->
            url = request.url
            jsonResponse(HttpStatusCode.OK, """{"total_results":0,"products":[]}""")
        }

        source.searchAudiobooks(SearchTerm("Der Hobbit"), PageNumber(3), PageSize(50))

        assertEquals("/1.0/catalog/products", url!!.encodedPath)
        assertEquals("Der Hobbit", url.parameters["keywords"])
        assertEquals("50", url.parameters["num_results"])
        assertEquals("2", url.parameters["page"])
        assertEquals("Relevance", url.parameters["products_sort_by"])
        assertEquals("contributors,media,product_attrs", url.parameters["response_groups"])
        assertEquals("500,1024", url.parameters["image_sizes"])
    }

    @Test
    fun `search never asks for more than 50 results`() = runBlocking {
        var numResults: String? = null
        val source = sourceWith { request ->
            numResults = request.url.parameters["num_results"]
            jsonResponse(HttpStatusCode.OK, """{"products":[]}""")
        }

        source.searchAudiobooks(SearchTerm("x"), PageNumber.FIRST, PageSize(100))

        assertEquals("50", numResults)
    }

    @Test
    fun `products map to audiobooks with the large image as full and the small one as thumbnail`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"total_results":120,"products":[
                    {"asin":"B1","title":"Der Hobbit","subtitle":"ignored",
                     "authors":[{"asin":"A","name":"J.R.R. Tolkien"}],"narrators":[{"name":"Rufus Beck"}],
                     "release_date":"2011-12-01",
                     "product_images":{"500":"https://img.example/b1-500.jpg","1024":"https://img.example/b1-1024.jpg"}}
                ]}""",
            )
        }

        val page = source.searchAudiobooks(SearchTerm("hobbit"), PageNumber.FIRST, PageSize(50))

        assertEquals(120, page.totalItems)
        val book = page.items.single()
        assertEquals("B1", book.asin)
        assertEquals("Der Hobbit", book.name)
        assertEquals(listOf("J.R.R. Tolkien"), book.authors)
        assertEquals(listOf("Rufus Beck"), book.narrators)
        assertEquals(ReleaseYear(2011), book.releaseYear)
        assertEquals("https://img.example/b1-1024.jpg", book.cover.imageUrl.value)
        assertEquals("https://img.example/b1-500.jpg", book.cover.thumbnailUrl.value)
        assertNull(book.cover.width)
        assertNull(book.cover.height)
    }

    @Test
    fun `the 500 image is the full image when there is no 1024 one and products without images are skipped`() =
        runBlocking {
            val source = sourceWith {
                jsonResponse(
                    HttpStatusCode.OK,
                    """{"total_results":3,"products":[
                        {"asin":"B1","title":"Small","product_images":{"500":"https://img.example/s-500.jpg"}},
                        {"asin":"B2","title":"No Images"},
                        {"asin":"B3","title":"Empty Images","product_images":{}}
                    ]}""",
                )
            }

            val page = source.searchAudiobooks(SearchTerm("x"), PageNumber.FIRST, PageSize(50))

            val book = page.items.single()
            assertEquals("https://img.example/s-500.jpg", book.cover.imageUrl.value)
            assertEquals("https://img.example/s-500.jpg", book.cover.thumbnailUrl.value)
            assertNull(book.releaseYear)
            assertEquals(emptyList(), book.authors)
        }

    @Test
    fun `a missing total falls back to a page-monotone estimate`() = runBlocking {
        val source = sourceWith {
            jsonResponse(
                HttpStatusCode.OK,
                """{"products":[{"asin":"B1","title":"T","product_images":{"500":"https://img.example/a.jpg"}}]}""",
            )
        }

        val page = source.searchAudiobooks(SearchTerm("x"), PageNumber(2), PageSize(50))

        assertEquals(51, page.totalItems)
    }

    @Test
    fun `a non-2xx response is an external source exception`() {
        val source = sourceWith { jsonResponse(HttpStatusCode.BadRequest, "{}") }

        val e = assertFailsWith<ExternalSourceException> {
            runBlocking { source.searchAudiobooks(SearchTerm("x"), PageNumber.FIRST, PageSize(50)) }
        }

        assertEquals("audible", e.source)
    }

    @Test
    fun `a malformed body is an external source exception`() {
        val source = sourceWith { jsonResponse(HttpStatusCode.OK, "<html>") }

        val e = assertFailsWith<ExternalSourceException> {
            runBlocking { source.searchAudiobooks(SearchTerm("x"), PageNumber.FIRST, PageSize(50)) }
        }

        assertEquals("audible", e.source)
    }

    @Test
    fun `an io failure is an external source exception`() {
        val source = sourceWith { throw IOException("down") }

        val e = assertFailsWith<ExternalSourceException> {
            runBlocking { source.searchAudiobooks(SearchTerm("x"), PageNumber.FIRST, PageSize(50)) }
        }

        assertEquals("audible", e.source)
    }
}
