package de.sluit.mediatracker.games

import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.api.ExpansionResponse
import de.sluit.mediatracker.games.api.GameResponse
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
import org.jetbrains.exposed.v1.jdbc.deleteAll
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Smoke tests for game expansions: the real `module()` on the Testcontainers MariaDB shared by the test JVM
 * ([appWithUser]), a real login, real SQL; happy paths only, at least one valid request per operation
 * (ADR 0011). Everything negative lives in [de.sluit.mediatracker.games.api.ExpansionRoutesTest]. `game_expansions`
 * rows go with their game through the FK `ON DELETE CASCADE`, so cleaning up `GamesTable` is enough.
 */
class ExpansionsSmokeTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(): HttpClient {
        val client = appWithUser("alice", "wonderland-1") {
            GamesTable.deleteAll()
        }
        client.loginAs("alice", "wonderland-1")
        return client
    }

    private suspend fun HttpClient.createdGame(): GameResponse = post("/api/games") {
        jsonBody("""{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"]}""")
    }.decodeBody()

    private suspend fun HttpClient.createExpansion(gameId: String, title: String): HttpResponse =
        post("/api/games/$gameId/expansions") { jsonBody("""{"title":"$title"}""") }

    private suspend fun HttpClient.expansions(gameId: String): List<ExpansionResponse> =
        get("/api/games/$gameId/expansions").decodeBody()

    @Test
    fun `creating two expansions returns them from the list in insertion order with dense sequences`() =
        testApplication {
            val client = loggedInClient()
            val game = client.createdGame()

            val first = client.createExpansion(game.id, "Farewell")
            assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
            val firstExpansion = first.decodeBody<ExpansionResponse>()
            assertEquals("/api/games/${game.id}/expansions/${firstExpansion.id}", first.headers["Location"])

            val second = client.createExpansion(game.id, "The Chasm")
            assertEquals(HttpStatusCode.Created, second.status, second.bodyAsText())
            val secondExpansion = second.decodeBody<ExpansionResponse>()

            val listed = client.expansions(game.id)
            assertEquals(listOf("Farewell", "The Chasm"), listed.map { it.title })
            assertEquals(listOf(0, 1), listed.map { it.sequence })
            assertEquals(listOf(firstExpansion.id, secondExpansion.id), listed.map { it.id })
        }

    @Test
    fun `patching an expansion's title and status is visible when reading it back`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame()
        val expansion = client.createExpansion(game.id, "Farewell").decodeBody<ExpansionResponse>()

        val patched = client.patch("/api/games/${game.id}/expansions/${expansion.id}") {
            jsonBody("""{"title":"Farewell (Chapter 9)","ownership":"owned","progress":"finished"}""")
        }

        assertEquals(HttpStatusCode.OK, patched.status, patched.bodyAsText())
        val patchedExpansion = patched.decodeBody<ExpansionResponse>()
        assertEquals("Farewell (Chapter 9)", patchedExpansion.title)
        assertEquals("owned", patchedExpansion.ownership)
        assertEquals("finished", patchedExpansion.progress)

        val listed = client.expansions(game.id)
        assertEquals(patchedExpansion, listed.single())
    }

    @Test
    fun `moving the last of three expansions to the front reorders all three densely`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame()
        val first = client.createExpansion(game.id, "Farewell").decodeBody<ExpansionResponse>()
        val second = client.createExpansion(game.id, "The Chasm").decodeBody<ExpansionResponse>()
        val third = client.createExpansion(game.id, "Core").decodeBody<ExpansionResponse>()

        val moved = client.patch("/api/games/${game.id}/expansions/${third.id}") { jsonBody("""{"sequence":0}""") }
        assertEquals(HttpStatusCode.OK, moved.status, moved.bodyAsText())
        assertEquals(0, moved.decodeBody<ExpansionResponse>().sequence)

        val listed = client.expansions(game.id)
        assertEquals(listOf(third.id, first.id, second.id), listed.map { it.id })
        assertEquals(listOf(0, 1, 2), listed.map { it.sequence })
    }

    @Test
    fun `deleting an expansion removes it and keeps the remaining sequences dense`() = testApplication {
        val client = loggedInClient()
        val game = client.createdGame()
        val first = client.createExpansion(game.id, "Farewell").decodeBody<ExpansionResponse>()
        val second = client.createExpansion(game.id, "The Chasm").decodeBody<ExpansionResponse>()

        val deleted = client.delete("/api/games/${game.id}/expansions/${first.id}")
        assertEquals(HttpStatusCode.NoContent, deleted.status)

        val listed = client.expansions(game.id)
        assertEquals(listOf(second.id), listed.map { it.id })
        assertEquals(listOf(0), listed.map { it.sequence })
    }

    // The former "deleting the game also removes its expansions" test only asserted a 404 from
    // GET .../expansions after the game was gone, which merely proves the game-exists check, not the cascade
    // delete of game_expansions rows - and ADR 0011 reserves smoke tests for happy paths, so a 4xx assertion does
    // not belong here regardless. The negative HTTP contract (unknown game -> 404) is pinned in
    // de.sluit.mediatracker.games.api.ExpansionRoutesTest, and the actual cascade is pinned in
    // ExposedExpansionRepositoryTest ("deleting the game cascades to its expansions"), so this test is dropped
    // rather than kept under a more honest name.
}
