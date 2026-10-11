package de.sluit.mediatracker.games

import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.api.PageResponse
import de.sluit.mediatracker.common.persistence.resetSeededReferenceData
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.api.GameDeveloperResponse
import de.sluit.mediatracker.games.api.GameDeveloperSummaryResponse
import de.sluit.mediatracker.games.api.GameMetaResponse
import de.sluit.mediatracker.games.api.GamePlatformResponse
import de.sluit.mediatracker.games.api.GamePlatformSummaryResponse
import de.sluit.mediatracker.games.api.GameResponse
import de.sluit.mediatracker.games.api.GameSeriesResponse
import de.sluit.mediatracker.games.api.GameSeriesSummaryResponse
import de.sluit.mediatracker.games.persistence.GameDevelopersTable
import de.sluit.mediatracker.games.persistence.GameSeriesTable
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
            // After the games: developers are RESTRICTed while a junction row exists, which cascades with the games.
            GameDevelopersTable.deleteAll()
            GameSeriesTable.deleteAll()
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
    fun `create with a release date and developer ids stores and returns them`() = testApplication {
        val client = loggedInClient()
        val developer = client.post("/api/game-developers") { jsonBody("""{"name":"Nintendo EPD"}""") }
            .decodeBody<GameDeveloperResponse>()

        val created = client.createGame(
            """{"title":"Chrono Trigger","platformIds":["${SeededPlatforms.PC}"],
                |"releaseDate":"1995-03-11","developerIds":["${developer.id}"]}
            """.trimMargin(),
        ).decodeBody<GameResponse>()

        assertEquals("1995-03-11", created.releaseDate)
        assertEquals(1995, created.releaseYear)
        assertEquals(listOf("Nintendo EPD"), created.developers.map { it.name })
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(created, listed.items.first())
    }

    @Test
    fun `game-developers search finds a developer by prefix and create is idempotent`() = testApplication {
        val client = loggedInClient()
        val created = client.post("/api/game-developers") { jsonBody("""{"name":"Monolith Soft"}""") }
        assertEquals(HttpStatusCode.Created, created.status)
        val monolith = created.decodeBody<GameDeveloperResponse>()

        val again = client.post("/api/game-developers") { jsonBody("""{"name":"monolith soft"}""") }
        assertEquals(HttpStatusCode.OK, again.status)
        assertEquals(monolith.id, again.decodeBody<GameDeveloperResponse>().id)

        val found = client.get("/api/game-developers?search=mono").decodeBody<List<GameDeveloperResponse>>()
        assertEquals(listOf(monolith), found)
    }

    private suspend fun HttpClient.createdDeveloper(name: String): GameDeveloperResponse =
        post("/api/game-developers") { jsonBody("""{"name":"$name"}""") }.decodeBody()

    @Test
    fun `game platforms can be created edited listed with counts and deleted`() = testApplication {
        resetSeededReferenceData()
        val client = loggedInClient()

        val created = client.post("/api/game-platforms") {
            jsonBody("""{"label":" Switch 2 ","associatedColor":"ff00ff"}""")
        }
        assertEquals(HttpStatusCode.Created, created.status)
        val switch = created.decodeBody<GamePlatformResponse>()
        assertEquals("/api/game-platforms/${switch.id}", created.headers["Location"])
        assertEquals(GamePlatformResponse(switch.id, "Switch 2", "FF00FF"), switch)

        val patched = client.patch("/api/game-platforms/${switch.id}") {
            jsonBody("""{"label":"Switch Two","associatedColor":"00ff00"}""")
        }.decodeBody<GamePlatformResponse>()
        assertEquals(GamePlatformResponse(switch.id, "Switch Two", "00FF00"), patched)

        val celeste = client.createdGame(
            """{"title":"Celeste","releaseYear":2018,"platformIds":["${switch.id}"]}""",
        )
        val summaries = client.get("/api/game-platforms.summaries").decodeBody<List<GamePlatformSummaryResponse>>()
        assertEquals(
            listOf("Nintendo" to 0, "PC" to 0, "PlayStation" to 0, "Switch Two" to 1, "Xbox" to 0),
            summaries.map { it.label to it.gameCount },
        )

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/games/${celeste.id}").status)
        assertEquals(HttpStatusCode.NoContent, client.delete("/api/game-platforms/${switch.id}").status)
    }

    @Test
    fun `developer summaries and developer games list counts and games in release order`() = testApplication {
        val client = loggedInClient()
        val nintendo = client.createdDeveloper("Nintendo EPD")
        val empty = client.createdDeveloper("Another Developer")
        listOf("Later" to 2010, "Earlier" to 2005).forEach { (title, year) ->
            client.createGame(
                """{"title":"$title","releaseYear":$year,"platformIds":["${SeededPlatforms.PC}"],
                    |"developerIds":["${nintendo.id}"]}
                """.trimMargin(),
            )
        }

        val summaries = client.get("/api/game-developers.summaries").decodeBody<List<GameDeveloperSummaryResponse>>()
        val games = client.get("/api/game-developers/${nintendo.id}/games").decodeBody<List<GameResponse>>()
        val noGames = client.get("/api/game-developers/${empty.id}/games").decodeBody<List<GameResponse>>()

        assertEquals(listOf("Another Developer" to 0, "Nintendo EPD" to 2), summaries.map { it.name to it.gameCount })
        assertEquals(listOf("Earlier", "Later"), games.map { it.title })
        assertEquals(emptyList(), noGames)
    }

    @Test
    fun `delete removes an unused developer from the summaries`() = testApplication {
        val client = loggedInClient()
        val developer = client.createdDeveloper("Nintendo EPD")

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/game-developers/${developer.id}").status)

        val names = client.get("/api/game-developers.summaries").decodeBody<List<GameDeveloperSummaryResponse>>()
        assertEquals(emptyList(), names.map { it.name })
    }

    @Test
    fun `rename changes a developer's name in the summaries`() = testApplication {
        val client = loggedInClient()
        val developer = client.createdDeveloper("Nintendo EDP")

        val response = client.patch("/api/game-developers/${developer.id}") { jsonBody("""{"name":"Nintendo EPD"}""") }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals(GameDeveloperResponse(developer.id, "Nintendo EPD"), response.decodeBody<GameDeveloperResponse>())
        val names = client.get("/api/game-developers.summaries").decodeBody<List<GameDeveloperSummaryResponse>>()
        assertEquals(listOf("Nintendo EPD"), names.map { it.name })
    }

    @Test
    fun `merge moves the games of a developer into the target and removes the source`() = testApplication {
        val client = loggedInClient()
        val source = client.createdDeveloper("Nintendo")
        val target = client.createdDeveloper("Nintendo EPD")
        client.createGame(
            """{"title":"Zelda","releaseYear":1998,"platformIds":["${SeededPlatforms.NINTENDO}"],
                |"developerIds":["${source.id}"]}
            """.trimMargin(),
        )

        val response = client.post("/api/game-developers/${source.id}/merge") {
            jsonBody("""{"targetId":"${target.id}"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals(target, response.decodeBody<GameDeveloperResponse>())
        val summaries = client.get("/api/game-developers.summaries").decodeBody<List<GameDeveloperSummaryResponse>>()
        assertEquals(listOf("Nintendo EPD" to 1), summaries.map { it.name to it.gameCount })
    }

    private suspend fun HttpClient.createdSeries(name: String): GameSeriesResponse =
        post("/api/game-series") { jsonBody("""{"name":"$name"}""") }.decodeBody()

    private suspend fun HttpClient.createGameInSeries(title: String, links: String): GameResponse = createGame(
        """{"title":"$title","releaseYear":2000,"platformIds":["${SeededPlatforms.PC}"],"series":$links}""",
    ).decodeBody()

    @Test
    fun `create with series stores them and a patch replaces and clears the series`() = testApplication {
        val client = loggedInClient()
        val zelda = client.createdSeries("Zelda")
        val mario = client.createdSeries("Mario")

        val created = client.createGameInSeries(
            "Crossover",
            """[{"seriesId":"${zelda.id}","position":2.5},{"seriesId":"${mario.id}"}]""",
        )
        assertEquals(listOf("Mario" to null, "Zelda" to 2.5), created.series.map { it.name to it.position })
        val listed = client.get("/api/games").decodeBody<PageResponse<GameResponse>>()
        assertEquals(created, listed.items.single())

        val replaced = client.patch("/api/games/${created.id}") {
            jsonBody("""{"series":[{"seriesId":"${mario.id}","position":1}]}""")
        }.decodeBody<GameResponse>()
        assertEquals(listOf("Mario" to 1.0), replaced.series.map { it.name to it.position })

        val unchanged = client.patch("/api/games/${created.id}") { jsonBody("""{"hidden":true}""") }
            .decodeBody<GameResponse>()
        assertEquals(replaced.series, unchanged.series)

        val cleared = client.patch("/api/games/${created.id}") { jsonBody("""{"series":[]}""") }
            .decodeBody<GameResponse>()
        assertEquals(emptyList(), cleared.series)
    }

    @Test
    fun `series summaries and series games list counts and games in series order`() = testApplication {
        val client = loggedInClient()
        val zelda = client.createdSeries("Zelda")
        val empty = client.createdSeries("Another Series")
        client.createGameInSeries("Unnumbered", """[{"seriesId":"${zelda.id}"}]""")
        client.createGameInSeries("Second", """[{"seriesId":"${zelda.id}","position":2}]""")
        client.createGameInSeries("First", """[{"seriesId":"${zelda.id}","position":1}]""")

        val summaries = client.get("/api/game-series.summaries").decodeBody<List<GameSeriesSummaryResponse>>()
        val games = client.get("/api/game-series/${zelda.id}/games").decodeBody<List<GameResponse>>()
        val noGames = client.get("/api/game-series/${empty.id}/games").decodeBody<List<GameResponse>>()

        assertEquals(listOf("Another Series" to 0, "Zelda" to 3), summaries.map { it.name to it.gameCount })
        assertEquals(listOf("First", "Second", "Unnumbered"), games.map { it.title })
        assertEquals(emptyList(), noGames)
    }

    @Test
    fun `game-series search finds a series by prefix and create is idempotent`() = testApplication {
        val client = loggedInClient()
        val created = client.post("/api/game-series") { jsonBody("""{"name":"Mario Kart"}""") }
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val kart = created.decodeBody<GameSeriesResponse>()

        val again = client.post("/api/game-series") { jsonBody("""{"name":"mario kart"}""") }
        assertEquals(HttpStatusCode.OK, again.status, again.bodyAsText())
        assertEquals(kart.id, again.decodeBody<GameSeriesResponse>().id)

        val found = client.get("/api/game-series?search=mar").decodeBody<List<GameSeriesResponse>>()
        assertEquals(listOf(kart), found)
    }

    @Test
    fun `delete removes an unused series from the summaries`() = testApplication {
        val client = loggedInClient()
        val unused = client.createdSeries("Unused")

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/game-series/${unused.id}").status)

        val names = client.get("/api/game-series.summaries").decodeBody<List<GameSeriesSummaryResponse>>()
        assertEquals(emptyList(), names.map { it.name })
    }

    @Test
    fun `rename changes a series' name in the summaries`() = testApplication {
        val client = loggedInClient()
        val series = client.createdSeries("Zelad")

        val response = client.patch("/api/game-series/${series.id}") { jsonBody("""{"name":"Zelda"}""") }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals(GameSeriesResponse(series.id, "Zelda"), response.decodeBody<GameSeriesResponse>())
        val names = client.get("/api/game-series.summaries").decodeBody<List<GameSeriesSummaryResponse>>()
        assertEquals(listOf("Zelda"), names.map { it.name })
    }

    @Test
    fun `merge moves the games of a series into the target keeping positions and removes the source`() =
        testApplication {
            val client = loggedInClient()
            val source = client.createdSeries("Zelda Old")
            val target = client.createdSeries("Zelda")
            val game = client.createGameInSeries("Ocarina", """[{"seriesId":"${source.id}","position":3}]""")

            val response = client.post("/api/game-series/${source.id}/merge") {
                jsonBody("""{"targetId":"${target.id}"}""")
            }

            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            assertEquals(target, response.decodeBody<GameSeriesResponse>())
            val summaries = client.get("/api/game-series.summaries").decodeBody<List<GameSeriesSummaryResponse>>()
            assertEquals(listOf("Zelda" to 1), summaries.map { it.name to it.gameCount })
            val moved = client.get("/api/game-series/${target.id}/games").decodeBody<List<GameResponse>>().single()
            assertEquals(game.id, moved.id)
            assertEquals(listOf(3.0), moved.series.map { it.position })
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
            """{"title":"Return to Hades","releaseYear":2021,"platformIds":["${SeededPlatforms.PC}"],
                |"description":"A roguelike inspired by Hades"}
            """.trimMargin(),
        )
        client.createGame("""{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"]}""")

        val page = client.get("/api/games?search=hades").decodeBody<PageResponse<GameResponse>>()

        assertEquals(listOf("Hades", "Return to Hades"), page.items.map { it.title })
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
        resetSeededReferenceData()
        val client = loggedInClient()

        val platforms = client.get("/api/game-platforms").decodeBody<List<GamePlatformResponse>>()

        assertEquals(listOf("Nintendo", "PC", "PlayStation", "Xbox"), platforms.map { it.label })
        assertEquals(SeededPlatforms.PC, platforms.first { it.label == "PC" }.id)
        assertEquals("757575", platforms.first { it.label == "PC" }.associatedColor)
    }

    @Test
    fun `cover options answer 503 cover_source_unavailable while no api key is configured`() = testApplication {
        val client = loggedInClient()

        val response = client.get("/api/games/cover-options?query=x")

        assertEquals(HttpStatusCode.ServiceUnavailable, response.status, response.bodyAsText())
        assertEquals("cover_source_unavailable", response.decodeBody<ErrorResponse>().error)
    }

    @Test
    fun `title suggestions answer 200 with an empty list while no api key is configured`() = testApplication {
        val client = loggedInClient()

        val response = client.get("/api/games/title-suggestions?query=Hades")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals("""{"suggestions":[]}""", response.bodyAsText())
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
        assertEquals(mapOf(SeededPlatforms.PC to 1), meta.platformCounts)
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
