package de.sluit.mediatracker.backup

import de.sluit.mediatracker.appWithUser
import de.sluit.mediatracker.backup.api.ImportResultResponse
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.api.GameResponse
import de.sluit.mediatracker.games.persistence.GamesTable
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAs
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.jetbrains.exposed.v1.jdbc.deleteAll
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Smoke test for `/api/backup` (MT-023, ADR 0027): the real `module()` on the Testcontainers MariaDB shared by
 * the test JVM ([appWithUser]), a real login, real SQL; happy paths only (ADR 0011). Everything negative lives
 * in [de.sluit.mediatracker.backup.api.BackupRoutesTest].
 */
class BackupSmokeTest {
    private suspend fun ApplicationTestBuilder.loggedInClient(): HttpClient {
        val client = appWithUser("alice", "wonderland-1") {
            GamesTable.deleteAll()
        }
        client.loginAs("alice", "wonderland-1")
        return client
    }

    @Test
    fun `exporting then importing the export back inserts nothing the second time`() = testApplication {
        val client = loggedInClient()
        val created = client.post("/api/games") {
            jsonBody("""{"title":"Celeste","releaseYear":2018,"platformIds":["${SeededPlatforms.PC}"]}""")
        }.decodeBody<GameResponse>()

        val exported = client.get("/api/backup/export")
        assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
        val exportedText = exported.bodyAsText()
        assertTrue(exportedText.contains(created.id), exportedText)

        val imported = client.post("/api/backup/import") { jsonBody(exportedText) }

        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        val result = imported.decodeBody<ImportResultResponse>()
        assertEquals(0, result.tables.getValue("games").inserted)
        assertEquals(1, result.tables.getValue("games").skipped)
    }
}
