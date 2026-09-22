package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.ExpansionPatch
import de.sluit.mediatracker.games.domain.ExpansionService
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.NewExpansion
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.domain.Title
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
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Handler tests for `/api/games/{id}/expansions`: real plugins and routes through [handlerApp],
 * [ExpansionService] is a MockK mock (strict), sessions live in memory, no database is opened. They pin the HTTP
 * contract mirrored in `frontend/src/types/api.ts` and the exact domain values the handlers hand to the service;
 * business behaviour lives in `ExpansionServiceTest` and the repository tests.
 */
class ExpansionRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInHandlerClient(expansions: ExpansionService): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth, expansions = expansions)
        client.loginAsMocked(auth)
        return client
    }

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

    private fun expansion(
        gameId: GameId,
        title: String = "Farewell",
        sequence: Int = 0,
        id: ExpansionId = ExpansionId.new(),
        ownership: Ownership = Ownership.DEFAULT,
        progress: Progress = Progress.DEFAULT,
    ): Expansion = Expansion(
        id = id,
        gameId = gameId,
        sequence = SequenceNumber(sequence),
        title = Title(title),
        ownership = ownership,
        progress = progress,
    )

    // ---- list ----

    @Test
    fun `list renders the service's expansions in order as json`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val first = expansion(gameId, title = "First", sequence = 0)
        val second = expansion(gameId, title = "Second", sequence = 1)
        coEvery { expansions.list(gameId) } returns listOf(first, second)

        val response = client.get("/api/games/$gameId/expansions").decodeBody<List<ExpansionResponse>>()

        assertEquals(listOf("First", "Second"), response.map { it.title })
        assertEquals(listOf(0, 1), response.map { it.sequence })
    }

    // ---- create ----

    @Test
    fun `create returns 201 with a location header pointing at the new expansion`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val created = expansion(gameId, title = "Farewell")
        coEvery { expansions.create(gameId, any()) } returns created

        val response = client.post("/api/games/$gameId/expansions") { jsonBody("""{"title":"Farewell"}""") }

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals("/api/games/$gameId/expansions/${created.id}", response.headers["Location"])
    }

    @Test
    fun `create hands the parsed request to the service`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val captured = slot<NewExpansion>()
        coEvery { expansions.create(gameId, capture(captured)) } returns expansion(gameId, title = "Farewell")

        client.post("/api/games/$gameId/expansions") {
            jsonBody("""{"title":"Farewell","ownership":"owned","progress":"playing"}""")
        }

        assertEquals(Title("Farewell"), captured.captured.title)
        assertEquals(Ownership.OWNED, captured.captured.ownership)
        assertEquals(Progress.PLAYING, captured.captured.progress)
    }

    @Test
    fun `create without status fields reaches the service as the domain defaults`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val captured = slot<NewExpansion>()
        coEvery { expansions.create(gameId, capture(captured)) } returns expansion(gameId, title = "Farewell")

        client.post("/api/games/$gameId/expansions") { jsonBody("""{"title":"Farewell"}""") }

        assertEquals(Ownership.DEFAULT, captured.captured.ownership)
        assertEquals(Progress.DEFAULT, captured.captured.progress)
    }

    // ---- patch ----

    @Test
    fun `patch maps the status and title fields to the service and returns the response`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val id = ExpansionId.new()
        val captured = slot<ExpansionPatch>()
        val updated =
            expansion(
                gameId,
                title = "Farewell (updated)",
                id = id,
                ownership = Ownership.OWNED,
                progress = Progress.FINISHED,
            )
        coEvery { expansions.update(gameId, id, capture(captured)) } returns updated

        val response = client.patch("/api/games/$gameId/expansions/$id") {
            jsonBody("""{"title":"Farewell (updated)","ownership":"owned","progress":"finished"}""")
        }.decodeBody<ExpansionResponse>()

        assertEquals(Title("Farewell (updated)"), captured.captured.title)
        assertEquals(Ownership.OWNED, captured.captured.ownership)
        assertEquals(Progress.FINISHED, captured.captured.progress)
        assertNull(captured.captured.sequence)
        assertEquals("Farewell (updated)", response.title)
        assertEquals("owned", response.ownership)
        assertEquals("finished", response.progress)
    }

    @Test
    fun `patch maps sequence to a move request`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val id = ExpansionId.new()
        val captured = slot<ExpansionPatch>()
        coEvery { expansions.update(gameId, id, capture(captured)) } returns expansion(gameId, id = id, sequence = 2)

        client.patch("/api/games/$gameId/expansions/$id") { jsonBody("""{"sequence":2}""") }

        assertEquals(SequenceNumber(2), captured.captured.sequence)
        assertNull(captured.captured.title)
        assertNull(captured.captured.ownership)
        assertNull(captured.captured.progress)
    }

    @Test
    fun `patch with an absent field leaves it unchanged in the patch`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val id = ExpansionId.new()
        val captured = slot<ExpansionPatch>()
        coEvery { expansions.update(gameId, id, capture(captured)) } returns expansion(gameId, id = id)

        client.patch("/api/games/$gameId/expansions/$id") { jsonBody("{}") }

        assertNull(captured.captured.title)
        assertNull(captured.captured.ownership)
        assertNull(captured.captured.progress)
        assertNull(captured.captured.sequence)
    }

    @Test
    fun `patch of an unknown expansion is 404 not_found`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val id = ExpansionId.new()
        coEvery { expansions.update(gameId, id, any()) } throws NotFoundException("expansion", id.toString())

        client.patch("/api/games/$gameId/expansions/$id") { jsonBody("{}") }
            .assertError(HttpStatusCode.NotFound, "not_found")
    }

    // ---- delete ----

    @Test
    fun `delete returns 204 and passes both ids to the service`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        val id = ExpansionId.new()
        coEvery { expansions.delete(gameId, id) } just Runs

        val response = client.delete("/api/games/$gameId/expansions/$id")

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertEquals("", response.bodyAsText())
        coVerify { expansions.delete(gameId, id) }
    }

    // ---- create validation ----

    @Test
    fun `create rejects an unknown ownership value`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()

        client.post("/api/games/$gameId/expansions") {
            jsonBody("""{"title":"Farewell","ownership":"borrowed"}""")
        }.assertValidationError("ownership")
        coVerify(exactly = 0) { expansions.create(any(), any()) }
    }

    @Test
    fun `create rejects an unknown progress value`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()

        client.post("/api/games/$gameId/expansions") {
            jsonBody("""{"title":"Farewell","progress":"halfway"}""")
        }.assertValidationError("progress")
        coVerify(exactly = 0) { expansions.create(any(), any()) }
    }

    // ---- malformed bodies ----

    @Test
    fun `create with a malformed json body is 400 invalid_body`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()

        client.post("/api/games/$gameId/expansions") { jsonBody("""{"title":""") }
            .assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { expansions.create(any(), any()) }
    }

    // ---- unknown game ----

    @Test
    fun `list against an unknown game is 404 not_found`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        coEvery { expansions.list(gameId) } throws NotFoundException("game", gameId.toString())

        client.get("/api/games/$gameId/expansions").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `create against an unknown game is 404 not_found`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()
        coEvery { expansions.create(gameId, any()) } throws NotFoundException("game", gameId.toString())

        client.post("/api/games/$gameId/expansions") { jsonBody("""{"title":"Farewell"}""") }
            .assertError(HttpStatusCode.NotFound, "not_found")
    }

    // ---- malformed ids ----

    @Test
    fun `a malformed game id is 400 validation_error`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)

        client.get("/api/games/not-a-uuid/expansions").assertValidationError(GameId.FIELD)
        coVerify(exactly = 0) { expansions.list(any()) }
    }

    @Test
    fun `a malformed expansion id is 400 validation_error`() = testApplication {
        val expansions = mockk<ExpansionService>()
        val client = loggedInHandlerClient(expansions)
        val gameId = GameId.new()

        client.delete("/api/games/$gameId/expansions/not-a-uuid").assertValidationError(ExpansionId.FIELD)
        coVerify(exactly = 0) { expansions.delete(any(), any()) }
    }
}
