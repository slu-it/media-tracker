package de.sluit.mediatracker.games

import de.sluit.mediatracker.api.ErrorResponse
import de.sluit.mediatracker.api.PageResponse
import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.api.GamePlatformResponse
import de.sluit.mediatracker.games.api.GameResponse
import de.sluit.mediatracker.games.persistence.GameToPlatformTable
import de.sluit.mediatracker.games.persistence.GamesTable
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAs
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
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

class GamesApiTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(seed: () -> Unit = {}): HttpClient {
        val client = appWithUser("alice", "wonderland-1") {
            GamesTable.deleteAll()
            seed()
        }
        client.loginAs("alice", "wonderland-1")
        return client
    }

    private suspend fun HttpClient.createGame(body: String): HttpResponse = post("/api/games") { jsonBody(body) }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    @Test
    fun `anonymous access is rejected with json 401`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/games").status)
        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/games") { jsonBody("{}") }.status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/game-platforms").status)
    }

    @Test
    fun `create returns 201 with location and the stored game`() = testApplication {
        val client = loggedInClient()

        val created = client.createGame(
            """{"title":"Celeste","releaseYear":2018,
                |"platformIds":["${SeededPlatforms.NINTENDO}","${SeededPlatforms.PC}"],
                |"description":"A climbing game.","rating":4.75,
                |"coverImageUrl":"https://img.example/c.png"}
            """.trimMargin(),
        )
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val game = created.decodeBody<GameResponse>()
        assertEquals("/api/games/${game.id}", created.headers["Location"])
        assertEquals(36, game.id.length)
        assertEquals("Celeste", game.title)
        assertEquals(2018, game.releaseYear)
        assertEquals(listOf("Nintendo", "PC"), game.platforms.map { it.label })
        assertEquals(SeededPlatforms.NINTENDO, game.platforms.first().id)
        assertEquals("E60012", game.platforms.first().associatedColor)
        assertEquals(SeededPlatforms.PC, game.platforms.last().id)
        assertEquals("A climbing game.", game.description)
        assertEquals(4.75, game.rating)
        assertEquals("https://img.example/c.png", game.coverImageUrl)

        val withoutOptionals = client.createGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}""",
        )
        assertEquals(HttpStatusCode.Created, withoutOptionals.status)
        assertContains(withoutOptionals.bodyAsText(), "\"coverImageUrl\":null")
        val hades = withoutOptionals.decodeBody<GameResponse>()
        assertNull(hades.coverImageUrl)
        assertNull(hades.description)
        assertNull(hades.rating)
    }

    @Test
    fun `create rejects invalid values with 400 validation_error naming the field`() = testApplication {
        val client = loggedInClient()

        val blankTitle = client.createGame(
            """{"title":"  ","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"]}""",
        )
        val error = blankTitle.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("title:"), error.message)

        client.createGame("""{"title":"x","releaseYear":20180,"platformIds":["${SeededPlatforms.PC}"]}""")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        client.createGame("""{"title":"x","releaseYear":2018,"platformIds":[]}""")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        client.createGame("""{"title":"x","releaseYear":2018,"platformIds":["${Uuid.random()}"]}""")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        client.createGame("""{"title":"x","releaseYear":2018,"platformIds":["not-a-uuid"]}""")
            .assertError(HttpStatusCode.BadRequest, "validation_error")

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],
                |"description":"${"x".repeat(10001)}"}
            """.trimMargin(),
        ).assertError(HttpStatusCode.BadRequest, "validation_error")

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],"rating":5.1}""",
        ).assertError(HttpStatusCode.BadRequest, "validation_error")
        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],"rating":0.3}""",
        ).assertError(HttpStatusCode.BadRequest, "validation_error")
        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],"rating":0}""",
        ).assertError(HttpStatusCode.BadRequest, "validation_error")

        client.createGame(
            """{"title":"x","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],
                |"coverImageUrl":"/relative.png"}
            """.trimMargin(),
        ).assertError(HttpStatusCode.BadRequest, "validation_error")

        assertEquals(0, client.get("/api/games").decodeBody<PageResponse<GameResponse>>().totalItems)
    }

    @Test
    fun `malformed bodies are 400 invalid_body`() = testApplication {
        val client = loggedInClient()

        client.createGame("""{"title":"x",""").assertError(HttpStatusCode.BadRequest, "invalid_body")
        client.createGame("""{"title":"x"}""").assertError(HttpStatusCode.BadRequest, "invalid_body")
        client.createGame(
            """{"title":"x","releaseYear":"two thousand","platformIds":["${SeededPlatforms.PC}"]}""",
        ).assertError(HttpStatusCode.BadRequest, "invalid_body")
        client.post("/api/games").assertError(HttpStatusCode.BadRequest, "invalid_body")
    }

    @Test
    fun `list is paginated with a default page size of 50 and ordered by title`() = testApplication {
        val client = loggedInClient {
            GamesTable.batchInsert(1..51) { n ->
                this[GamesTable.id] = Uuid.random().toString()
                this[GamesTable.title] = "Game %02d".format(n)
                this[GamesTable.releaseYear] = 2000
                this[GamesTable.coverImageUrl] = null
            }
            GameToPlatformTable.batchInsert(
                GamesTable.selectAll().map { it[GamesTable.id] },
            ) { gameId ->
                this[GameToPlatformTable.gameId] = gameId
                this[GameToPlatformTable.platformId] = SeededPlatforms.PC
            }
        }

        val first = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(50, first.items.size)
        assertEquals(1, first.page)
        assertEquals(50, first.pageSize)
        assertEquals(51, first.totalItems)
        assertEquals(2, first.totalPages)
        assertEquals("Game 01", first.items.first().title)
        assertEquals("Game 50", first.items.last().title)
        assertEquals(listOf("PC"), first.items.first().platforms.map { it.label })

        val second = client.get("/api/games?page=2").decodeBody<PageResponse<GameResponse>>()
        assertEquals(listOf("Game 51"), second.items.map { it.title })
        assertEquals(2, second.page)

        val small = client.get("/api/games?page=3&pageSize=20").decodeBody<PageResponse<GameResponse>>()
        assertEquals(11, small.items.size)
        assertEquals(3, small.totalPages)

        val beyond = client.get("/api/games?page=9").decodeBody<PageResponse<GameResponse>>()
        assertEquals(0, beyond.items.size)
        assertEquals(51, beyond.totalItems)

        client.get("/api/games?page=0").assertError(HttpStatusCode.BadRequest, "validation_error")
        client.get("/api/games?pageSize=201").assertError(HttpStatusCode.BadRequest, "validation_error")
        client.get("/api/games?page=x").assertError(HttpStatusCode.BadRequest, "validation_error")
    }

    @Test
    fun `empty list has zero pages`() = testApplication {
        val client = loggedInClient()
        val page = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(0, page.totalItems)
        assertEquals(0, page.totalPages)
        assertEquals(emptyList(), page.items)
    }

    @Test
    fun `patch updates only the given fields and can clear optional fields`() = testApplication {
        val client = loggedInClient()
        val game = client.createGame(
            """{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.NINTENDO}"],
                |"description":"Original","rating":4.5,
                |"coverImageUrl":"https://img.example/c.png"}
            """.trimMargin(),
        ).decodeBody<GameResponse>()

        val retitled = client.patch("/api/games/${game.id}") { jsonBody("""{"title":"Celeste (Switch)"}""") }
        assertEquals(HttpStatusCode.OK, retitled.status, retitled.bodyAsText())
        val afterTitle = retitled.decodeBody<GameResponse>()
        assertEquals("Celeste (Switch)", afterTitle.title)
        assertEquals(2018, afterTitle.releaseYear)
        assertEquals(listOf("Nintendo"), afterTitle.platforms.map { it.label })
        assertEquals("Original", afterTitle.description)
        assertEquals(4.5, afterTitle.rating)
        assertEquals("https://img.example/c.png", afterTitle.coverImageUrl)

        val cleared = client.patch("/api/games/${game.id}") {
            jsonBody("""{"coverImageUrl":null,"description":null,"rating":null}""")
        }.decodeBody<GameResponse>()
        assertNull(cleared.coverImageUrl)
        assertNull(cleared.description)
        assertNull(cleared.rating)
        assertEquals("Celeste (Switch)", cleared.title)

        val replatformed = client.patch("/api/games/${game.id}") {
            jsonBody(
                """{"platformIds":["${SeededPlatforms.PC}","${SeededPlatforms.XBOX}"],
                    |"coverImageUrl":"https://img.example/new.png","releaseYear":2019}
                """.trimMargin(),
            )
        }.decodeBody<GameResponse>()
        assertEquals(listOf("PC", "Xbox"), replatformed.platforms.map { it.label })
        assertEquals("https://img.example/new.png", replatformed.coverImageUrl)
        assertEquals(2019, replatformed.releaseYear)

        val noop = client.patch("/api/games/${game.id}") { jsonBody("{}") }.decodeBody<GameResponse>()
        assertEquals(replatformed, noop)

        // Changes are persisted, not just echoed.
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(listOf(replatformed), listed.items)
    }

    @Test
    fun `patch validates like create and reports unknown or malformed ids`() = testApplication {
        val client = loggedInClient()
        val game = client.createGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}""",
        ).decodeBody<GameResponse>()

        client.patch("/api/games/${game.id}") { jsonBody("""{"title":""}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        client.patch("/api/games/${game.id}") { jsonBody("""{"platformIds":[]}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        client.patch("/api/games/${game.id}") { jsonBody("""{"platformIds":["${Uuid.random()}"]}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        client.patch("/api/games/${game.id}") { jsonBody("""{"platformIds":["not-a-uuid"]}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        client.patch("/api/games/${game.id}") { jsonBody("""{"description":"${"x".repeat(10001)}"}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        client.patch("/api/games/${game.id}") { jsonBody("""{"rating":5.25}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        client.patch("/api/games/${Uuid.random()}") { jsonBody("""{"title":"x"}""") }
            .assertError(HttpStatusCode.NotFound, "not_found")
        client.patch("/api/games/not-a-uuid") { jsonBody("""{"title":"x"}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
    }

    @Test
    fun `delete is idempotent, returns 204 and removes junction rows`() = testApplication {
        val client = loggedInClient()
        val game = client.createGame(
            """{"title":"Hades","releaseYear":2020,
                |"platformIds":["${SeededPlatforms.PC}","${SeededPlatforms.XBOX}"]}
            """.trimMargin(),
        ).decodeBody<GameResponse>()

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/games/${game.id}").status)
        assertEquals(HttpStatusCode.NoContent, client.delete("/api/games/${game.id}").status)
        assertEquals(HttpStatusCode.NoContent, client.delete("/api/games/${Uuid.random()}").status)
        client.delete("/api/games/not-a-uuid").assertError(HttpStatusCode.BadRequest, "validation_error")

        client.patch("/api/games/${game.id}") { jsonBody("""{"title":"x"}""") }
            .assertError(HttpStatusCode.NotFound, "not_found")
        assertEquals(0, client.get("/api/games").decodeBody<PageResponse<GameResponse>>().totalItems)

        transaction {
            assertEquals(
                0,
                GameToPlatformTable.selectAll().where { GameToPlatformTable.gameId eq game.id }.count(),
            )
        }
    }

    @Test
    fun `game-platforms lists the four seeded platforms sorted by label`() = testApplication {
        val client = loggedInClient()

        val platforms = client.get("/api/game-platforms").decodeBody<List<GamePlatformResponse>>()
        assertEquals(listOf("Nintendo", "PC", "PlayStation", "Xbox"), platforms.map { it.label })
        assertEquals(SeededPlatforms.PC, platforms.first { it.label == "PC" }.id)
        assertEquals("757575", platforms.first { it.label == "PC" }.associatedColor)
    }
}
