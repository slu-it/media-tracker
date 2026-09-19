package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageNumber
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePatch
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.games.domain.NewGame
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.game
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
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Handler tests for `/api/games` and `/api/game-platforms`: real plugins and routes through [handlerApp],
 * [GameService] is a MockK mock (strict), sessions live in memory, no database is opened. They pin the HTTP
 * contract mirrored in `frontend/src/types/api.ts` and the exact domain values the handlers hand to the
 * service; business behaviour lives in `GameServiceTest` and the repository tests.
 */
class GameRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInHandlerClient(games: GameService): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth, games)
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpClient.createGame(body: String): HttpResponse = post("/api/games") { jsonBody(body) }

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

    // ---- auth ----

    @Test
    fun `anonymous access is rejected with json 401 without reaching the service`() = testApplication {
        val games = mockk<GameService>()
        val client = handlerApp(games = games)

        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/games").status)
        assertEquals(HttpStatusCode.Unauthorized, client.createGame("{}").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/game-platforms").status)

        coVerify(exactly = 0) { games.create(any()) }
        coVerify(exactly = 0) { games.list(any(), any()) }
        coVerify(exactly = 0) { games.listPlatforms() }
    }

    // ---- create ----

    @Test
    fun `create returns 201 with a location header pointing at the new game`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val created = game("Celeste")
        coEvery { games.create(any()) } returns created

        val response = client.createGame(VALID_GAME_BODY)

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals("/api/games/${created.id}", response.headers["Location"])
    }

    @Test
    fun `create response mirrors the returned game`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val created = game(
            "Celeste",
            platforms = listOf(Platforms.NINTENDO, Platforms.PC),
            description = Description("A climbing game."),
            rating = Rating(4.75),
            coverImageUrl = CoverImageUrl("https://img.example/c.png"),
        )
        coEvery { games.create(any()) } returns created

        val response = client.createGame(VALID_GAME_BODY).decodeBody<GameResponse>()

        assertEquals(created.id.toString(), response.id)
        assertEquals("Celeste", response.title)
        assertEquals(2018, response.releaseYear)
        assertEquals(listOf("Nintendo", "PC"), response.platforms.map { it.label })
        assertEquals(Platforms.NINTENDO.id.toString(), response.platforms.first().id)
        assertEquals("E60012", response.platforms.first().associatedColor)
        assertEquals(Platforms.PC.id.toString(), response.platforms.last().id)
        assertEquals("A climbing game.", response.description)
        assertEquals(4.75, response.rating)
        assertEquals("https://img.example/c.png", response.coverImageUrl)
    }

    @Test
    fun `create response renders missing optional fields as explicit nulls`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.create(any()) } returns game("Hades")

        val response =
            client.createGame("""{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}""")

        val body = response.bodyAsText()
        assertContains(body, "\"description\":null")
        assertContains(body, "\"rating\":null")
        assertContains(body, "\"coverImageUrl\":null")
    }

    @Test
    fun `create hands the parsed request to the service`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val captured = slot<NewGame>()
        coEvery { games.create(capture(captured)) } returns game("Celeste")

        client.createGame(VALID_GAME_BODY)

        assertEquals(Title("Celeste"), captured.captured.title)
        assertEquals(ReleaseYear(2018), captured.captured.releaseYear)
        assertEquals(
            setOf(GamePlatformId.parse(SeededPlatforms.NINTENDO), GamePlatformId.parse(SeededPlatforms.PC)),
            captured.captured.platformIds,
        )
        assertEquals(Description("A climbing game."), captured.captured.description)
        assertEquals(Rating(4.75), captured.captured.rating)
        assertEquals(CoverImageUrl("https://img.example/c.png"), captured.captured.coverImageUrl)
    }

    @Test
    fun `create maps absent optional fields to null`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val captured = slot<NewGame>()
        coEvery { games.create(capture(captured)) } returns game("Hades")

        client.createGame("""{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}""")

        assertNull(captured.captured.description)
        assertNull(captured.captured.rating)
        assertNull(captured.captured.coverImageUrl)
    }

    @Test
    fun `a validation error thrown by the service is a 400 validation_error`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.create(any()) } throws InvalidValueException(GamePlatformId.FIELD, "unknown platform id")

        client.createGame(VALID_GAME_BODY).assertValidationError("platformIds")
    }

    // ---- create validation ----

    @Test
    fun `create rejects a blank title`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame("""{"title":"  ","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"]}""")
            .assertValidationError("title")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a five-digit release year`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame("""{"title":"x","releaseYear":20180,"platformIds":["${SeededPlatforms.PC}"]}""")
            .assertValidationError("releaseYear")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects an empty platform list`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame("""{"title":"x","releaseYear":2018,"platformIds":[]}""")
            .assertValidationError("platformIds")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a malformed platform id`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame("""{"title":"x","releaseYear":2018,"platformIds":["not-a-uuid"]}""")
            .assertValidationError("platformIds")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a description over 10000 characters`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],
                |"description":"${"x".repeat(10001)}"}
            """.trimMargin(),
        ).assertValidationError("description")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a rating above 5`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],"rating":5.1}""",
        ).assertValidationError("rating")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a rating that is not a quarter step`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],"rating":0.3}""",
        ).assertValidationError("rating")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a zero rating`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],"rating":0}""",
        ).assertValidationError("rating")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create rejects a relative cover image url`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],
                |"coverImageUrl":"/relative.png"}
            """.trimMargin(),
        ).assertValidationError("coverImageUrl")
        coVerify(exactly = 0) { games.create(any()) }
    }

    // ---- malformed bodies ----

    @Test
    fun `create with a truncated json body is 400 invalid_body`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame("""{"title":"x",""").assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create with a body missing required fields is 400 invalid_body`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame("""{"title":"x"}""").assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create with a wrongly typed field is 400 invalid_body`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.createGame(
            """{"title":"x","releaseYear":"two thousand","platformIds":["${SeededPlatforms.PC}"]}""",
        ).assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { games.create(any()) }
    }

    @Test
    fun `create with a missing body is 400 invalid_body`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.post("/api/games").assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { games.create(any()) }
    }

    // ---- list ----

    @Test
    fun `list without parameters asks the service for page 1 of 50`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.list(any(), any()) } returns Page(emptyList(), PageNumber.FIRST, PageSize.DEFAULT, 0)

        client.get("/api/games")

        coVerify { games.list(PageRequest(PageNumber(1), PageSize(50)), null) }
    }

    @Test
    fun `list passes page and page size to the service`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.list(any(), any()) } returns Page(emptyList(), PageNumber(3), PageSize(10), 0)

        client.get("/api/games?page=3&pageSize=10")

        coVerify { games.list(PageRequest(PageNumber(3), PageSize(10)), null) }
    }

    @Test
    fun `list response carries the items and the paging fields`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val page = Page(
            items = listOf(game("Chrono Trigger"), game("Hades", platforms = listOf(Platforms.XBOX))),
            page = PageNumber(2),
            size = PageSize(10),
            totalItems = 25,
        )
        coEvery { games.list(any(), any()) } returns page

        val response = client.get("/api/games?page=2&pageSize=10").decodeBody<PageResponse<GameResponse>>()

        assertEquals(listOf("Chrono Trigger", "Hades"), response.items.map { it.title })
        assertEquals(listOf("PC"), response.items.first().platforms.map { it.label })
        assertEquals(listOf("Xbox"), response.items.last().platforms.map { it.label })
        assertEquals(2, response.page)
        assertEquals(10, response.pageSize)
        assertEquals(25, response.totalItems)
        assertEquals(3, response.totalPages)
    }

    @Test
    fun `list passes a trimmed search term to the service`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.list(any(), any()) } returns Page(emptyList(), PageNumber.FIRST, PageSize.DEFAULT, 0)

        client.get("/api/games?search=%20hades%20")

        coVerify { games.list(PageRequest(PageNumber(1), PageSize(50)), SearchTerm("hades")) }
    }

    @Test
    fun `list with a blank search term passes no search term`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.list(any(), any()) } returns Page(emptyList(), PageNumber.FIRST, PageSize.DEFAULT, 0)

        client.get("/api/games?search=%20%20")

        coVerify { games.list(PageRequest(PageNumber(1), PageSize(50)), null) }
    }

    @Test
    fun `list rejects a search term over 200 characters`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.get("/api/games?search=${"x".repeat(201)}").assertValidationError("search")
        coVerify(exactly = 0) { games.list(any(), any()) }
    }

    @Test
    fun `list rejects page 0`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.get("/api/games?page=0").assertValidationError("page")
        coVerify(exactly = 0) { games.list(any(), any()) }
    }

    @Test
    fun `list rejects a page size above 200`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.get("/api/games?pageSize=201").assertValidationError("pageSize")
        coVerify(exactly = 0) { games.list(any(), any()) }
    }

    @Test
    fun `list rejects a non integer page`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.get("/api/games?page=x").assertValidationError("page")
        coVerify(exactly = 0) { games.list(any(), any()) }
    }

    // ---- patch ----

    @Test
    fun `patch with an empty body sends a patch that changes nothing`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val captured = slot<GamePatch>()
        val id = GameId.new()
        coEvery { games.update(any(), capture(captured)) } returns game("Celeste", id = id)

        client.patch("/api/games/$id") { jsonBody("{}") }

        assertNull(captured.captured.title)
        assertNull(captured.captured.releaseYear)
        assertNull(captured.captured.platformIds)
        assertEquals(Patch.Unchanged, captured.captured.description)
        assertEquals(Patch.Unchanged, captured.captured.rating)
        assertEquals(Patch.Unchanged, captured.captured.coverImageUrl)
    }

    @Test
    fun `patch with null clears the optional fields`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val captured = slot<GamePatch>()
        val id = GameId.new()
        coEvery { games.update(any(), capture(captured)) } returns game("Celeste", id = id)

        client.patch("/api/games/$id") {
            jsonBody("""{"description":null,"rating":null,"coverImageUrl":null}""")
        }

        assertEquals(Patch.Change(null), captured.captured.description)
        assertEquals(Patch.Change(null), captured.captured.rating)
        assertEquals(Patch.Change(null), captured.captured.coverImageUrl)
    }

    @Test
    fun `patch maps every present field to the domain patch`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val captured = slot<GamePatch>()
        val id = GameId.new()
        coEvery { games.update(any(), capture(captured)) } returns game("Celeste", id = id)

        client.patch("/api/games/$id") {
            jsonBody(
                """{"title":"Celeste (Switch)","releaseYear":2019,
                    |"platformIds":["${SeededPlatforms.PC}","${SeededPlatforms.XBOX}"],
                    |"description":"Updated","rating":4.5,"coverImageUrl":"https://img.example/new.png"}
                """.trimMargin(),
            )
        }

        assertEquals(Title("Celeste (Switch)"), captured.captured.title)
        assertEquals(ReleaseYear(2019), captured.captured.releaseYear)
        assertEquals(
            setOf(GamePlatformId.parse(SeededPlatforms.PC), GamePlatformId.parse(SeededPlatforms.XBOX)),
            captured.captured.platformIds,
        )
        assertEquals(Patch.Change(Description("Updated")), captured.captured.description)
        assertEquals(Patch.Change(Rating(4.5)), captured.captured.rating)
        assertEquals(
            Patch.Change(CoverImageUrl("https://img.example/new.png")),
            captured.captured.coverImageUrl,
        )
    }

    @Test
    fun `patch passes the path id to the service`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val capturedId = slot<GameId>()
        val id = GameId.new()
        coEvery { games.update(capture(capturedId), any()) } returns game("Celeste", id = id)

        client.patch("/api/games/$id") { jsonBody("{}") }

        assertEquals(id, capturedId.captured)
    }

    @Test
    fun `patch response mirrors the updated game`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val id = GameId.new()
        val updated = game("Celeste (Switch)", id = id, platforms = listOf(Platforms.NINTENDO))
        coEvery { games.update(any(), any()) } returns updated

        val response = client.patch("/api/games/$id") { jsonBody("{}") }.decodeBody<GameResponse>()

        assertEquals(id.toString(), response.id)
        assertEquals("Celeste (Switch)", response.title)
        assertEquals(listOf("Nintendo"), response.platforms.map { it.label })
    }

    @Test
    fun `patch of an unknown game is 404 not_found`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.update(any(), any()) } throws NotFoundException("game", "unknown")

        client.patch("/api/games/${GameId.new()}") { jsonBody("""{"title":"x"}""") }
            .assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `patch with a malformed id is 400 validation_error`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.patch("/api/games/not-a-uuid") { jsonBody("""{"title":"x"}""") }
            .assertValidationError(GameId.FIELD)
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    // ---- patch validation ----

    @Test
    fun `patch rejects a blank title`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.patch("/api/games/${GameId.new()}") { jsonBody("""{"title":""}""") }
            .assertValidationError("title")
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    @Test
    fun `patch rejects an empty platform list`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.patch("/api/games/${GameId.new()}") { jsonBody("""{"platformIds":[]}""") }
            .assertValidationError("platformIds")
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    @Test
    fun `patch rejects a malformed platform id`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.patch("/api/games/${GameId.new()}") { jsonBody("""{"platformIds":["not-a-uuid"]}""") }
            .assertValidationError("platformIds")
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    @Test
    fun `patch rejects a description over 10000 characters`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.patch("/api/games/${GameId.new()}") {
            jsonBody("""{"description":"${"x".repeat(10001)}"}""")
        }.assertValidationError("description")
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    @Test
    fun `patch rejects a rating above 5`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.patch("/api/games/${GameId.new()}") { jsonBody("""{"rating":5.25}""") }
            .assertValidationError("rating")
        coVerify(exactly = 0) { games.update(any(), any()) }
    }

    // ---- delete ----

    @Test
    fun `delete returns 204 and passes the id to the service`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        val id = GameId.new()
        coEvery { games.delete(any()) } just Runs

        val response = client.delete("/api/games/$id")

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertEquals("", response.bodyAsText())
        coVerify { games.delete(GameId.parse(id.toString())) }
    }

    @Test
    fun `delete with a malformed id is 400 validation_error`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)

        client.delete("/api/games/not-a-uuid").assertValidationError(GameId.FIELD)
        coVerify(exactly = 0) { games.delete(any()) }
    }

    // ---- platforms ----

    @Test
    fun `game-platforms renders the platforms in the order the service returns them`() = testApplication {
        val games = mockk<GameService>()
        val client = loggedInHandlerClient(games)
        coEvery { games.listPlatforms() } returns
            listOf(Platforms.NINTENDO, Platforms.PC, Platforms.PLAYSTATION, Platforms.XBOX)

        val response = client.get("/api/game-platforms").decodeBody<List<GamePlatformResponse>>()

        assertEquals(
            listOf(
                GamePlatformResponse(Platforms.NINTENDO.id.toString(), "Nintendo", "E60012"),
                GamePlatformResponse(Platforms.PC.id.toString(), "PC", "757575"),
                GamePlatformResponse(Platforms.PLAYSTATION.id.toString(), "PlayStation", "0070D1"),
                GamePlatformResponse(Platforms.XBOX.id.toString(), "Xbox", "107C10"),
            ),
            response,
        )
    }

    private companion object {
        val VALID_GAME_BODY = """{"title":"Celeste","releaseYear":2018,
            |"platformIds":["${SeededPlatforms.NINTENDO}","${SeededPlatforms.PC}"],
            |"description":"A climbing game.","rating":4.75,
            |"coverImageUrl":"https://img.example/c.png"}
        """.trimMargin()
    }
}
