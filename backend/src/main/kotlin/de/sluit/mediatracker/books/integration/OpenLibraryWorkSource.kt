package de.sluit.mediatracker.books.integration

import de.sluit.mediatracker.books.domain.BookWork
import de.sluit.mediatracker.books.domain.BookWorkId
import de.sluit.mediatracker.books.domain.BookWorkSource
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.CoverOption
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.config.OpenLibraryConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.accept
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import org.slf4j.LoggerFactory
import java.io.IOException

/**
 * Open Library adapter for [BookWorkSource] (ADR 0039). Outward-facing (`books.integration -> books.domain`).
 *
 * A work's covers are the work's own `covers` followed by every edition's, deduplicated, and paged in memory
 * (one `editions.json?limit=1000` call, so the total is exact for all but pathological works). A 404 for a work
 * means "no such work" and becomes an empty page. Every other non-2xx response, a body that does not parse or an
 * [IOException] becomes an [ExternalSourceException]; the User-Agent is the only thing sent besides the query.
 */
class OpenLibraryWorkSource(private val client: HttpClient, private val config: OpenLibraryConfig) : BookWorkSource {
    private val log = LoggerFactory.getLogger(OpenLibraryWorkSource::class.java)

    override suspend fun searchWorks(term: SearchTerm): List<BookWork> {
        val response = request("${config.baseUrl}/search.json") {
            parameter("q", term.value)
            parameter("fields", "key,title,author_name,first_publish_year,cover_i")
            parameter("limit", SEARCH_LIMIT)
        }
        if (!response.status.isSuccess()) throw upstreamFailure(response)
        return decode<OlSearchResponse>(response).docs.mapNotNull { it.toWorkOrNull() }
    }

    override suspend fun findWorkCovers(id: BookWorkId, page: PageNumber, size: PageSize): Page<CoverOption> {
        val workResponse = request("${config.baseUrl}/works/${id.value}.json")
        if (workResponse.status == HttpStatusCode.NotFound) return Page(emptyList(), page, size, 0)
        if (!workResponse.status.isSuccess()) throw upstreamFailure(workResponse)
        val workCovers = decode<OlWork>(workResponse).covers.orEmpty()

        val editionsResponse = request("${config.baseUrl}/works/${id.value}/editions.json") {
            parameter("limit", EDITIONS_LIMIT)
        }
        val editionCovers = when {
            editionsResponse.status == HttpStatusCode.NotFound -> emptyList()
            !editionsResponse.status.isSuccess() -> throw upstreamFailure(editionsResponse)
            else -> decode<OlEditions>(editionsResponse).entries.flatMap { it.covers.orEmpty() }
        }

        val all = (workCovers + editionCovers).filter { it > 0 }.distinct()
        val offset = (page.value - 1L) * size.value
        val items = if (offset >= all.size) {
            emptyList()
        } else {
            all.subList(offset.toInt(), minOf(all.size.toLong(), offset + size.value).toInt()).map { it.toOption() }
        }
        return Page(items, page, size, all.size.toLong())
    }

    private suspend fun request(url: String, block: HttpRequestBuilder.() -> Unit = {}) = try {
        client.get(url) {
            header(HttpHeaders.UserAgent, config.userAgent)
            accept(ContentType.Application.Json)
            block()
        }
    } catch (e: IOException) {
        throw ExternalSourceException(SOURCE, "request to open library failed", e)
    }

    private suspend inline fun <reified T> decode(response: HttpResponse): T = try {
        response.body()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        throw ExternalSourceException(
            SOURCE,
            "open library response could not be parsed (status ${response.status.value})",
            e,
        )
    }

    private fun upstreamFailure(response: HttpResponse): ExternalSourceException {
        log.warn("open library returned status {}", response.status.value)
        return ExternalSourceException(SOURCE, "open library returned status ${response.status.value}")
    }

    private fun OlSearchDoc.toWorkOrNull(): BookWork? = try {
        val workId = key?.removePrefix("/works/")
        val name = title?.trim()
        if (workId == null || name.isNullOrEmpty()) {
            null
        } else {
            BookWork(
                id = BookWorkId(workId),
                name = name,
                authors = authorName.orEmpty().map { it.trim() }.filter { it.isNotEmpty() },
                releaseYear = firstPublishYear?.let { runCatching { ReleaseYear(it) }.getOrNull() },
                hasCover = coverId != null && coverId > 0,
            )
        }
    } catch (_: InvalidValueException) {
        null
    }

    private fun Long.toOption() = CoverOption(
        thumbnailUrl = CoverImageUrl("${config.coversBaseUrl}/b/id/$this-M.jpg"),
        imageUrl = CoverImageUrl("${config.coversBaseUrl}/b/id/$this-L.jpg"),
        width = null,
        height = null,
    )

    companion object {
        const val SOURCE = "open_library"
        private const val SEARCH_LIMIT = 20
        private const val EDITIONS_LIMIT = 1000
    }
}
