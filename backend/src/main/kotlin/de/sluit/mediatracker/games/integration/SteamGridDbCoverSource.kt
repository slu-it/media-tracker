package de.sluit.mediatracker.games.integration

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.config.SteamGridDbConfig
import de.sluit.mediatracker.games.domain.COVER_PAGE_SIZE
import de.sluit.mediatracker.games.domain.CoverCandidate
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.CoverOption
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSource
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.CoverType
import de.sluit.mediatracker.games.domain.ReleaseYear
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.java.Java
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.accept
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.encodeURLPathPart
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import org.slf4j.LoggerFactory
import java.io.IOException
import java.time.Instant
import java.time.ZoneOffset

/**
 * SteamGridDB adapter for [CoverSource] (MT-017, ADR 0024). Outward-facing (`games.integration -> games.domain`);
 * the domain never imports this package. Built from [client] (see [steamGridDbHttpClient] for the engine
 * `Application.kt` wires up only when `STEAMGRIDDB_API_KEY` is set) and [config] (base URL and API key).
 *
 * Every non-2xx response, a `success: false` envelope, a missing `data`, a body that fails to deserialise or an
 * [IOException] talking to SteamGridDB becomes an [ExternalSourceException] — except a 404 from the grids
 * endpoint, which SteamGridDB uses for "no such game" and which this adapter turns into an empty list. The
 * upstream API key is never included in an exception message.
 */
class SteamGridDbCoverSource(private val client: HttpClient, private val config: SteamGridDbConfig) : CoverSource {
    private val log = LoggerFactory.getLogger(SteamGridDbCoverSource::class.java)

    override suspend fun searchGames(term: SearchTerm): List<CoverCandidate> {
        val response = request("${config.baseUrl}/search/autocomplete/${term.value.encodeURLPathPart()}")
        val envelope = decode<List<SgdbGame>>(response)
        if (!response.status.isSuccess()) throw upstreamFailure(response, envelope)
        if (!envelope.success) throw upstreamFailure(response, envelope)
        val games = envelope.data ?: throw missingData(response)
        return games.mapNotNull { it.toCandidateOrNull() }
    }

    override suspend fun findCovers(id: CoverSourceGameId, type: CoverType, page: PageNumber): Page<CoverOption> {
        val response = request("${config.baseUrl}/grids/game/${id.value}") {
            parameter("dimensions", "600x900,660x930")
            parameter("types", type.wire)
            parameter("nsfw", "false")
            parameter("humor", "false")
            parameter("page", page.value - 1)
            parameter("limit", COVER_PAGE_SIZE)
        }
        val envelope = decode<List<SgdbGrid>>(response)
        if (!response.status.isSuccess()) {
            if (response.status == HttpStatusCode.NotFound) return Page(emptyList(), page, PageSize(COVER_PAGE_SIZE), 0)
            throw upstreamFailure(response, envelope)
        }
        if (!envelope.success) throw upstreamFailure(response, envelope)
        val grids = envelope.data ?: throw missingData(response)
        val items = grids.mapNotNull { it.toOptionOrNull() }
        val size =
            envelope.limit?.let { limit -> runCatching { PageSize(limit) }.getOrNull() } ?: PageSize(COVER_PAGE_SIZE)
        // Without a total, fall back to a page-monotone estimate rather than the item count alone: on page 2+ the
        // item count on its own would make the total shrink below the items already seen on earlier pages.
        val totalItems = envelope.total ?: (page.value - 1L) * size.value + items.size
        return Page(items, page, size, totalItems)
    }

    private suspend fun request(url: String, block: HttpRequestBuilder.() -> Unit = {}): HttpResponse = try {
        client.get(url) {
            header(HttpHeaders.Authorization, "Bearer ${config.apiKey}")
            accept(ContentType.Application.Json)
            block()
        }
    } catch (e: IOException) {
        throw ExternalSourceException(CoverOptionsService.SOURCE, "request to steamgriddb failed", e)
    }

    private suspend inline fun <reified T> decode(response: HttpResponse): SgdbEnvelope<T> = try {
        response.body()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        throw ExternalSourceException(
            CoverOptionsService.SOURCE,
            "steamgriddb response could not be parsed (status ${response.status.value})",
            e,
        )
    }

    private fun upstreamFailure(response: HttpResponse, envelope: SgdbEnvelope<*>): ExternalSourceException {
        if (envelope.errors.isNotEmpty()) {
            log.warn("steamgriddb returned status {} with errors: {}", response.status.value, envelope.errors)
        } else {
            log.warn("steamgriddb returned status {} with success={}", response.status.value, envelope.success)
        }
        return ExternalSourceException(
            CoverOptionsService.SOURCE,
            "steamgriddb returned status ${response.status.value} with success=false",
        )
    }

    private fun missingData(response: HttpResponse) = ExternalSourceException(
        CoverOptionsService.SOURCE,
        "steamgriddb response had no data (status ${response.status.value})",
    )

    private fun SgdbGame.toCandidateOrNull(): CoverCandidate? = try {
        CoverCandidate(
            id = CoverSourceGameId(id),
            name = name,
            releaseYear = releaseDate?.let(::yearOrNull),
            verified = verified,
        )
    } catch (_: InvalidValueException) {
        null
    }

    private fun yearOrNull(unixSeconds: Long): ReleaseYear? = try {
        ReleaseYear(Instant.ofEpochSecond(unixSeconds).atZone(ZoneOffset.UTC).year)
    } catch (_: InvalidValueException) {
        null
    }

    private fun SgdbGrid.toOptionOrNull(): CoverOption? = try {
        CoverOption(thumbnailUrl = CoverImageUrl(thumb), imageUrl = CoverImageUrl(url), width = width, height = height)
    } catch (_: InvalidValueException) {
        null
    }
}

/**
 * The Ktor client `module()` builds only when `STEAMGRIDDB_API_KEY` is configured: the JDK-backed [Java] engine
 * (JDK trust store, no extra transitive dependency, honours proxy properties), a lenient JSON ContentNegotiation,
 * `expectSuccess = false` (this adapter reads the status code itself) and a 10 s request timeout so a slow
 * upstream cannot stall a cover-options request indefinitely.
 */
fun steamGridDbHttpClient(): HttpClient = HttpClient(Java) {
    expectSuccess = false
    install(ContentNegotiation) {
        json(steamGridDbJson)
    }
    install(HttpTimeout) {
        requestTimeoutMillis = 10_000
    }
}
