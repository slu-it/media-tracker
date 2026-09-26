package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.backup.domain.BackupService
import de.sluit.mediatracker.backup.domain.CloudBackupService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.StoredFile
import de.sluit.mediatracker.common.domain.TableImportResult
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.dropbox.domain.DROPBOX_SOURCE
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

/**
 * Handler tests for `/api/backup`: real plugins and routes through [handlerApp], [BackupService] is a MockK
 * mock (strict), sessions live in memory, no database is opened. Pins the HTTP contract mirrored in
 * `frontend/src/types/api.ts` and the JSON <-> [BackupRow] conversion; the actual export/import logic is pinned
 * in `ExposedBackupSourceTest` and `BackupServiceTest`.
 */
class BackupRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInHandlerClient(
        backup: BackupService = mockk(),
        cloudBackup: CloudBackupService = mockk(),
    ): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth, backup = backup, cloudBackup = cloudBackup)
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    // ---- auth ----

    @Test
    fun `an anonymous export is a json 401 without reaching the service`() = testApplication {
        val backup = mockk<BackupService>()
        val client = handlerApp(backup = backup)

        client.get("/api/backup/export").assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify(exactly = 0) { backup.export() }
    }

    // ---- export ----

    @Test
    fun `export renders every table's rows with their json types`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)
        coEvery { backup.export() } returns mapOf(
            "game_platforms" to listOf(mapOf("id" to "1", "label" to "PC", "associated_color" to "757575")),
            "games" to listOf(
                mapOf(
                    "id" to "2",
                    "title" to "Celeste",
                    "release_year" to 2018L,
                    "description" to null,
                    "rating" to 4.5,
                    "hidden" to true,
                ),
            ),
        )

        val response = client.get("/api/backup/export")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val body = response.bodyAsText()
        assertTrue(body.contains("\"release_year\":2018"), body)
        assertTrue(body.contains("\"rating\":4.5"), body)
        assertTrue(body.contains("\"hidden\":true"), body)
        assertTrue(body.contains("\"description\":null"), body)
        assertTrue(body.contains("\"label\":\"PC\""), body)
    }

    // ---- import ----

    @Test
    fun `import posts the parsed rows to the service and renders the counts`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)
        val captured = slot<Map<String, List<BackupRow>>>()
        coEvery { backup.import(capture(captured)) } returns
            mapOf("games" to TableImportResult(inserted = 1, skipped = 0))

        val response = client.post("/api/backup/import") {
            jsonBody(
                """{"games":[{"id":"1","title":"Celeste","release_year":2018,"rating":4.5,"hidden":true,""" +
                    """"description":null}]}""",
            )
        }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val row = captured.captured.getValue("games").single()
        assertEquals("1", row["id"])
        assertEquals(2018L, row["release_year"])
        assertEquals(4.5, row["rating"])
        assertEquals(true, row["hidden"])
        assertEquals(null, row["description"])
        val body = response.decodeBody<ImportResultResponse>()
        assertEquals(1, body.tables.getValue("games").inserted)
        assertEquals(0, body.tables.getValue("games").skipped)
    }

    @Test
    fun `import rejects a table value that is not an array`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)

        client.post("/api/backup/import") { jsonBody("""{"games":{}}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        coVerify(exactly = 0) { backup.import(any()) }
    }

    @Test
    fun `import rejects a row that is not an object`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)

        client.post("/api/backup/import") { jsonBody("""{"games":["not an object"]}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        coVerify(exactly = 0) { backup.import(any()) }
    }

    @Test
    fun `import rejects a row value that is not a json primitive`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)

        client.post("/api/backup/import") { jsonBody("""{"games":[{"id":"1","tags":["a","b"]}]}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
        coVerify(exactly = 0) { backup.import(any()) }
    }

    @Test
    fun `import rejects a malformed json body`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)

        client.post("/api/backup/import") { jsonBody("""{"games":""") }
            .assertError(HttpStatusCode.BadRequest, "invalid_body")
        coVerify(exactly = 0) { backup.import(any()) }
    }

    @Test
    fun `import surfaces the service's validation failure as a 400`() = testApplication {
        val backup = mockk<BackupService>()
        val client = loggedInHandlerClient(backup)
        coEvery { backup.import(any()) } throws InvalidValueException("games", "bad row")

        client.post("/api/backup/import") { jsonBody("""{"games":[]}""") }
            .assertError(HttpStatusCode.BadRequest, "validation_error")
    }

    // ---- dropbox: get ----

    @Test
    fun `dropbox status answers 200 with the last backup's metadata`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        val modifiedAt = Instant.parse("2024-01-01T00:00:00Z")
        coEvery { cloudBackup.lastBackup() } returns
            StoredFile("/backup/full-export.json", modifiedAt, sizeBytes = 42L)

        val response = client.get("/api/backup/dropbox").decodeBody<CloudBackupResponse>()

        assertEquals(modifiedAt.toString(), response.lastBackup?.modifiedAt)
        assertEquals(42L, response.lastBackup?.sizeBytes)
    }

    @Test
    fun `dropbox status answers 200 with a null last backup when none exists yet`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        coEvery { cloudBackup.lastBackup() } returns null

        val response = client.get("/api/backup/dropbox").decodeBody<CloudBackupResponse>()

        assertNull(response.lastBackup)
    }

    @Test
    fun `dropbox status when not connected is 503 dropbox_unavailable`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        coEvery { cloudBackup.lastBackup() } throws ExternalSourceUnavailableException(DROPBOX_SOURCE)

        client.get("/api/backup/dropbox").assertError(HttpStatusCode.ServiceUnavailable, "dropbox_unavailable")
    }

    @Test
    fun `dropbox status on an upstream failure is 502 dropbox_error`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        coEvery { cloudBackup.lastBackup() } throws ExternalSourceException(DROPBOX_SOURCE, "upstream boom")

        client.get("/api/backup/dropbox").assertError(HttpStatusCode.BadGateway, "dropbox_error")
    }

    @Test
    fun `dropbox status for an anonymous request is a json 401 without reaching the service`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = handlerApp(cloudBackup = cloudBackup)

        client.get("/api/backup/dropbox").assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify(exactly = 0) { cloudBackup.lastBackup() }
    }

    // ---- dropbox: post ----

    @Test
    fun `backing up now answers 200 with the newly uploaded backup's metadata`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        val modifiedAt = Instant.parse("2024-01-01T00:00:00Z")
        coEvery { cloudBackup.backupNow() } returns
            StoredFile("/backup/full-export.json", modifiedAt, sizeBytes = 42L)

        val response = client.post("/api/backup/dropbox").decodeBody<CloudBackupResponse>()

        assertEquals(modifiedAt.toString(), response.lastBackup?.modifiedAt)
        assertEquals(42L, response.lastBackup?.sizeBytes)
        coVerify { cloudBackup.backupNow() }
    }

    @Test
    fun `backing up now when not connected is 503 dropbox_unavailable`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        coEvery { cloudBackup.backupNow() } throws ExternalSourceUnavailableException(DROPBOX_SOURCE)

        client.post("/api/backup/dropbox").assertError(HttpStatusCode.ServiceUnavailable, "dropbox_unavailable")
    }

    @Test
    fun `backing up now on an upstream failure is 502 dropbox_error`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = loggedInHandlerClient(cloudBackup = cloudBackup)
        coEvery { cloudBackup.backupNow() } throws ExternalSourceException(DROPBOX_SOURCE, "upstream boom")

        client.post("/api/backup/dropbox").assertError(HttpStatusCode.BadGateway, "dropbox_error")
    }

    @Test
    fun `backing up now for an anonymous request is a json 401 without reaching the service`() = testApplication {
        val cloudBackup = mockk<CloudBackupService>()
        val client = handlerApp(cloudBackup = cloudBackup)

        client.post("/api/backup/dropbox").assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify(exactly = 0) { cloudBackup.backupNow() }
    }
}
