package de.sluit.mediatracker.books.integration

import de.sluit.mediatracker.books.domain.Audiobook
import de.sluit.mediatracker.books.domain.AudiobookSource
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.CoverOption
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.config.AudibleConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.accept
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import org.slf4j.LoggerFactory
import java.io.IOException

/**
 * Audible catalog adapter for [AudiobookSource] (ADR 0039). The API is unofficial and may change without notice.
 * Each product is one cover (`1024` pixel image as the full image, falling back to `500`; `500` as thumbnail;
 * products without any image are skipped, sizes are reported as unknown). Audible's `page` is 0-based; the domain's
 * is 1-based. Every non-2xx response, unparsable body or [IOException] becomes an [ExternalSourceException].
 */
class AudibleAudiobookSource(private val client: HttpClient, private val config: AudibleConfig) : AudiobookSource {
    private val log = LoggerFactory.getLogger(AudibleAudiobookSource::class.java)

    override suspend fun searchAudiobooks(term: SearchTerm, page: PageNumber, size: PageSize): Page<Audiobook> {
        val resolvedSize = PageSize(minOf(size.value, MAX_RESULTS))
        val response = try {
            client.get("${config.baseUrl}/1.0/catalog/products") {
                accept(ContentType.Application.Json)
                parameter("keywords", term.value)
                parameter("num_results", resolvedSize.value)
                parameter("page", page.value - 1)
                parameter("products_sort_by", "Relevance")
                parameter("response_groups", "contributors,media,product_attrs")
                parameter("image_sizes", "500,1024")
            }
        } catch (e: IOException) {
            throw ExternalSourceException(SOURCE, "request to audible failed", e)
        }
        if (!response.status.isSuccess()) {
            log.warn("audible returned status {}", response.status.value)
            throw ExternalSourceException(SOURCE, "audible returned status ${response.status.value}")
        }
        val body = decode(response)
        val items = body.products.mapNotNull { it.toAudiobookOrNull() }
        val totalItems = body.totalResults ?: ((page.value - 1L) * resolvedSize.value + items.size)
        return Page(items, page, resolvedSize, totalItems)
    }

    private suspend fun decode(response: HttpResponse): AudibleResponse = try {
        response.body()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        throw ExternalSourceException(
            SOURCE,
            "audible response could not be parsed (status ${response.status.value})",
            e,
        )
    }

    private fun AudibleProduct.toAudiobookOrNull(): Audiobook? = try {
        val thumb = productImages?.get("500")?.takeIf { it.isNotBlank() }
        val full = productImages?.get("1024")?.takeIf { it.isNotBlank() } ?: thumb
        val name = title?.trim()
        if (asin == null || name.isNullOrEmpty() || thumb == null || full == null) {
            null
        } else {
            Audiobook(
                asin = asin,
                name = name,
                authors = authors.names(),
                narrators = narrators.names(),
                releaseYear = releaseDate?.take(YEAR_LENGTH)?.toIntOrNull()
                    ?.let { runCatching { ReleaseYear(it) }.getOrNull() },
                cover = CoverOption(CoverImageUrl(thumb), CoverImageUrl(full), width = null, height = null),
            )
        }
    } catch (_: InvalidValueException) {
        null
    }

    private fun List<AudibleContributor>.names() = mapNotNull { it.name?.trim()?.takeIf(String::isNotEmpty) }

    companion object {
        const val SOURCE = "audible"
        private const val MAX_RESULTS = 50
        private const val YEAR_LENGTH = 4
    }
}
