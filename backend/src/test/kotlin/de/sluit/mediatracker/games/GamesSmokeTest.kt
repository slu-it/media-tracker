package de.sluit.mediatracker.games

import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.api.GameMetaResponse
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
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.uuid.Uuid

/**
 * Smoke tests for the games domain: the real `module()` on the Testcontainers MariaDB shared by the test JVM
 * ([appWithUser]), a real login, real SQL; happy paths only, at least one valid request per operation and the
 * request variations that matter. Everything negative lives in [de.sluit.mediatracker.games.api.GameRoutesTest].
 * There is no GET by id; persistence is verified through GET /api/games.
 */
class GamesSmokeTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(seed: () -> Unit = {}): HttpClient {
        val client = appWithUser("alice", "wonderland-1") {
            GamesTable.deleteAll()
            seed()
        }
        client.loginAs("alice", "wonderland-1")
        return client
    }

    private suspend fun HttpClient.createGame(body: String): HttpResponse = post("/api/games") { jsonBody(body) }

    private suspend fun HttpClient.createdGame(body: String = VALID_GAME_BODY): GameResponse =
        createGame(body).decodeBody()

    /** Seeds [count] games titled "Game 01".."Game NN" (year 2000, platform PC), for pagination tests. */
    private fun seedGames(count: Int) {
        GamesTable.batchInsert(1..count) { n ->
            this[GamesTable.id] = Uuid.random().toString()
            this[GamesTable.title] = "Game %02d".format(n)
            this[GamesTable.releaseYear] = 2000
            this[GamesTable.coverImageUrl] = null
            this[GamesTable.ownership] = "watchlist"
            this[GamesTable.progress] = "not_started"
            this[GamesTable.hidden] = false
        }
        GameToPlatformTable.batchInsert(
            GamesTable.selectAll().map { it[GamesTable.id] },
        ) { gameId ->
            this[GameToPlatformTable.gameId] = gameId
            this[GameToPlatformTable.platformId] = SeededPlatforms.PC
        }
    }

    @Test
    fun `create with all fields returns the stored game with platforms sorted by label`() = testApplication {
        val client = loggedInClient()

        val created = client.createGame(VALID_GAME_BODY)

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
    }

    @Test
    fun `create without optional fields stores nulls`() = testApplication {
        val client = loggedInClient()

        val response = client.createGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}""",
        )

        assertEquals(HttpStatusCode.Created, response.status)
        assertContains(response.bodyAsText(), "\"coverImageUrl\":null")
        val hades = response.decodeBody<GameResponse>()
        assertNull(hades.coverImageUrl)
        assertNull(hades.description)
        assertNull(hades.rating)
    }

    @Test
    fun `create without status fields defaults to watchlist not started and visible`() = testApplication {
        val client = loggedInClient()

        val hades = client.createdGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"]}""",
        )

        assertEquals("watchlist", hades.ownership)
        assertEquals("not_started", hades.progress)
        assertEquals(false, hades.hidden)
    }

    @Test
    fun `create with status fields returns the stored game with them set`() = testApplication {
        val client = loggedInClient()

        val hades = client.createdGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"],
                |"ownership":"owned","progress":"playing","hidden":true}
            """.trimMargin(),
        )

        assertEquals("owned", hades.ownership)
        assertEquals("playing", hades.progress)
        assertEquals(true, hades.hidden)
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(hades, listed.items.first())
    }

    @Test
    fun `list with a search term returns the matches best first`() = testApplication {
        val client = loggedInClient()
        client.createGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"],
                |"description":"Escape the underworld"}
            """.trimMargin(),
        )
        client.createGame(
            """{"title":"Underworld Chronicles","releaseYear":2021,"platformIds":["${SeededPlatforms.PC}"],
                |"description":"A roguelike inspired by Hades"}
            """.trimMargin(),
        )
        client.createGame("""{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"]}""")

        val page = client.get("/api/games?search=hades").decodeBody<PageResponse<GameResponse>>()

        assertEquals(listOf("Hades", "Underworld Chronicles"), page.items.map { it.title })
        assertEquals(2, page.totalItems)
    }

    @Test
    fun `list with an ownership filter returns only games with that ownership`() = testApplication {
        val client = loggedInClient()
        client.createGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"],"ownership":"owned"}""",
        )
        client.createGame(
            """{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"],
                |"ownership":"watchlist"}
            """.trimMargin(),
        )

        val page = client.get("/api/games?ownership=owned").decodeBody<PageResponse<GameResponse>>()

        assertEquals(listOf("Hades"), page.items.map { it.title })
        assertEquals(1, page.totalItems)
    }

    @Test
    fun `list returns the games ordered by title with the paging totals`() = testApplication {
        val client = loggedInClient { seedGames(3) }

        val page = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()

        assertEquals(listOf("Game 01", "Game 02", "Game 03"), page.items.map { it.title })
        assertEquals(1, page.page)
        assertEquals(50, page.pageSize)
        assertEquals(3, page.totalItems)
        assertEquals(1, page.totalPages)
        assertEquals(listOf("PC"), page.items.first().platforms.map { it.label })
    }

    @Test
    fun `list returns a requested page with a smaller page size`() = testApplication {
        val client = loggedInClient { seedGames(51) }

        val small = client.get("/api/games?page=3&pageSize=20").decodeBody<PageResponse<GameResponse>>()

        assertEquals(11, small.items.size)
        assertEquals(3, small.page)
        assertEquals(20, small.pageSize)
        assertEquals(51, small.totalItems)
        assertEquals(3, small.totalPages)
        assertEquals("Game 41", small.items.first().title)
        assertEquals("Game 51", small.items.last().title)
    }

    @Test
    fun `patch changes a field and the change is visible in the list`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame(CELESTE_BODY)

        val patched = client.patch("/api/games/${game.id}") { jsonBody("""{"title":"Celeste (Switch)"}""") }
            .decodeBody<GameResponse>()

        assertEquals("Celeste (Switch)", patched.title)
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(listOf(patched), listed.items)
    }

    @Test
    fun `patch with null clears the optional fields`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame(CELESTE_BODY)

        val cleared = client.patch("/api/games/${game.id}") {
            jsonBody("""{"coverImageUrl":null,"description":null,"rating":null}""")
        }.decodeBody<GameResponse>()

        assertNull(cleared.coverImageUrl)
        assertNull(cleared.description)
        assertNull(cleared.rating)
        assertEquals("Celeste", cleared.title)
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertNull(listed.items.first().coverImageUrl)
    }

    @Test
    fun `patch changes the status fields and the change is visible in the list`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame(CELESTE_BODY)

        val patched = client.patch("/api/games/${game.id}") {
            jsonBody("""{"ownership":"owned","progress":"completed","hidden":true}""")
        }.decodeBody<GameResponse>()

        assertEquals("owned", patched.ownership)
        assertEquals("completed", patched.progress)
        assertEquals(true, patched.hidden)
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(listOf(patched), listed.items)
    }

    @Test
    fun `patch replaces the platform set`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame(CELESTE_BODY)

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
    }

    @Test
    fun `successive patches accumulate`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame(CELESTE_BODY)

        client.patch("/api/games/${game.id}") { jsonBody("""{"title":"Celeste (Switch)"}""") }

        val afterSecondPatch = client.patch("/api/games/${game.id}") { jsonBody("""{"rating":5.0}""") }
            .decodeBody<GameResponse>()

        assertEquals("Celeste (Switch)", afterSecondPatch.title)
        assertEquals(5.0, afterSecondPatch.rating)

        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals("Celeste (Switch)", listed.items.first().title)
        assertEquals(5.0, listed.items.first().rating)
    }

    @Test
    fun `delete removes the game from the list`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame(
            """{"title":"Hades","releaseYear":2020,
                |"platformIds":["${SeededPlatforms.PC}","${SeededPlatforms.XBOX}"]}
            """.trimMargin(),
        )

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/games/${game.id}").status)

        assertEquals(0, client.get("/api/games").decodeBody<PageResponse<GameResponse>>().totalItems)
    }

    @Test
    fun `game-platforms lists the four seeded platforms sorted by label`() = testApplication {
        val client = loggedInClient()

        val platforms = client.get("/api/game-platforms").decodeBody<List<GamePlatformResponse>>()

        assertEquals(listOf("Nintendo", "PC", "PlayStation", "Xbox"), platforms.map { it.label })
        assertEquals(SeededPlatforms.PC, platforms.first { it.label == "PC" }.id)
        assertEquals("757575", platforms.first { it.label == "PC" }.associatedColor)
    }

    @Test
    fun `games meta lists only the filter values actually in use`() = testApplication {
        val client = loggedInClient()
        client.createGame(
            """{"title":"Hades","releaseYear":2020,"platformIds":["${SeededPlatforms.PC}"],
                |"ownership":"owned","progress":"playing"}
            """.trimMargin(),
        )

        val meta = client.get("/api/games.meta").decodeBody<GameMetaResponse>()

        assertEquals(listOf("PC"), meta.platforms.map { it.label })
        assertEquals(listOf("owned"), meta.ownership)
        assertEquals(listOf("playing"), meta.progress)
        assertEquals(listOf(2020), meta.releaseYears)
    }

    private companion object {
        val VALID_GAME_BODY = """{"title":"Celeste","releaseYear":2018,
            |"platformIds":["${SeededPlatforms.NINTENDO}","${SeededPlatforms.PC}"],
            |"description":"A climbing game.","rating":4.75,
            |"coverImageUrl":"https://img.example/c.png"}
        """.trimMargin()

        val CELESTE_BODY = """{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.NINTENDO}"],
            |"description":"Original","rating":4.5,"coverImageUrl":"https://img.example/c.png"}
        """.trimMargin()
    }
}
