package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.domain.CoverCandidate
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.CoverOption
import de.sluit.mediatracker.games.domain.CoverOptions
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.CoverSourceGameId
import de.sluit.mediatracker.games.domain.GameId
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
 * Handler tests for `/api/games/{id}/cover-options`: real plugins and routes through [handlerApp],
 * [CoverOptionsService] is a MockK mock (strict), sessions live in memory, no database and no SteamGridDB call
 * happen. They pin the HTTP contract mirrored in `frontend/src/types/api.ts` and the exact domain values the
 * handler hands to the service; business behaviour lives in `CoverOptionsServiceTest` and the adapter's
 * `SteamGridDbCoverSourceTest`.
 *
 * The "not called at all" assertions below use `coVerify { coverOptions wasNot Called }` rather than
 * `coVerify(exactly = 0) { coverOptions.find(any(), any(), any()) }`: `any()`'s witness generation for a value
 * class always constructs a real instance (`JvmSignatureValueGenerator`), and for a `Long`-backed value class that
 * can be negative about half the time, which trips [CoverSourceGameId]'s `value > 0` check.
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

    // ---- happy path ----

    @Test
    fun `answers 200 with an explicit null selectedMatchId when nothing was found`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = emptyList(),
                selectedMatchId = null,
                covers = emptyList(),
            )

        val response = client.get("/api/games/$gameId/cover-options")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertTrue(response.bodyAsText().contains("\"selectedMatchId\":null"), response.bodyAsText())
    }

    @Test
    fun `answers 200 with the full shape when a match and covers are found`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } returns
            CoverOptions(
                query = SearchTerm("Hades"),
                matches = listOf(candidate(1, "Hades"), candidate(2, "Hades II")),
                selectedMatchId = CoverSourceGameId(1),
                covers = listOf(cover(1)),
            )

        val response = client.get("/api/games/$gameId/cover-options").decodeBody<CoverOptionsResponse>()

        assertEquals("Hades", response.query)
        assertEquals(listOf(1L, 2L), response.matches.map { it.id })
        assertEquals(listOf("Hades", "Hades II"), response.matches.map { it.name })
        assertEquals(1L, response.selectedMatchId)
        assertEquals(1, response.covers.size)
        assertEquals("https://example.org/thumb-1.png", response.covers.single().thumbnailUrl)
        assertEquals("https://example.org/full-1.png", response.covers.single().imageUrl)
    }

    // ---- query parameter mapping ----

    @Test
    fun `passes the parsed query and match to the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, SearchTerm("zelda"), CoverSourceGameId(5)) } returns
            CoverOptions(
                query = SearchTerm("zelda"),
                matches = emptyList(),
                selectedMatchId = null,
                covers = emptyList(),
            )

        client.get("/api/games/$gameId/cover-options?query=zelda&match=5")

        coVerify { coverOptions.find(gameId, SearchTerm("zelda"), CoverSourceGameId(5)) }
    }

    @Test
    fun `passes null query and match when neither is present`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                covers = emptyList(),
            )

        client.get("/api/games/$gameId/cover-options")

        coVerify { coverOptions.find(gameId, null, null) }
    }

    @Test
    fun `a blank query reaches the service as a null query`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                covers = emptyList(),
            )

        client.get("/api/games/$gameId/cover-options?query=%20%20")

        coVerify { coverOptions.find(gameId, null, null) }
    }

    @Test
    fun `an empty match reaches the service as a null match`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } returns
            CoverOptions(
                query = SearchTerm("game"),
                matches = emptyList(),
                selectedMatchId = null,
                covers = emptyList(),
            )

        client.get("/api/games/$gameId/cover-options?match=")

        coVerify { coverOptions.find(gameId, null, null) }
    }

    // ---- validation ----

    @Test
    fun `a non-numeric match is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()

        val response = client.get("/api/games/$gameId/cover-options?match=abc")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("match"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a zero match is 400 validation_error`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()

        val response = client.get("/api/games/$gameId/cover-options?match=0")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("match"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a 201-character query is 400 validation_error naming the field`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        val tooLong = "a".repeat(201)

        val response = client.get("/api/games/$gameId/cover-options?query=$tooLong")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("query"), error.message)
        coVerify { coverOptions wasNot Called }
    }

    @Test
    fun `a malformed game id is 400 validation_error`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)

        val response = client.get("/api/games/not-a-uuid/cover-options")

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(GameId.FIELD), error.message)
        coVerify { coverOptions wasNot Called }
    }

    // ---- error mapping ----

    @Test
    fun `an unknown game is 404 not_found`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } throws NotFoundException("game", gameId.toString())

        client.get("/api/games/$gameId/cover-options").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `an unconfigured source is 503 cover_source_unavailable`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } throws
            ExternalSourceUnavailableException(CoverOptionsService.SOURCE)

        client.get("/api/games/$gameId/cover-options")
            .assertError(HttpStatusCode.ServiceUnavailable, "cover_source_unavailable")
    }

    @Test
    fun `an upstream failure is 502 cover_source_error`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = loggedInHandlerClient(coverOptions)
        val gameId = GameId.new()
        coEvery { coverOptions.find(gameId, null, null) } throws
            ExternalSourceException(CoverOptionsService.SOURCE, "upstream boom")

        client.get("/api/games/$gameId/cover-options")
            .assertError(HttpStatusCode.BadGateway, "cover_source_error")
    }

    // ---- authentication ----

    @Test
    fun `an anonymous request is a json 401 without reaching the service`() = testApplication {
        val coverOptions = mockk<CoverOptionsService>()
        val client = handlerApp(coverOptions = coverOptions)
        val gameId = GameId.new()

        client.get("/api/games/$gameId/cover-options")
            .assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify { coverOptions wasNot Called }
    }
}
