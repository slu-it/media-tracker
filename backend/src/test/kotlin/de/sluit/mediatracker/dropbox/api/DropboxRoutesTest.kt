package de.sluit.mediatracker.dropbox.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.dropbox.domain.AuthorizationCode
import de.sluit.mediatracker.dropbox.domain.DROPBOX_SOURCE
import de.sluit.mediatracker.dropbox.domain.DropboxService
import de.sluit.mediatracker.dropbox.domain.DropboxStatus
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.mockk.Called
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Instant

/**
 * Handler tests for `/api/dropbox`: real plugins and routes through [handlerApp], [DropboxService] is a MockK
 * mock (strict), sessions live in memory, no database and no Dropbox call happen. They pin the HTTP contract
 * mirrored in `frontend/src/types/api.ts`; business behaviour lives in `DropboxServiceTest`.
 */
class DropboxRoutesTest {
    private suspend fun ApplicationTestBuilder.loggedInHandlerClient(dropbox: DropboxService): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth, dropbox = dropbox)
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    // ---- status ----

    @Test
    fun `status answers 200 with connected false and a null connectedAt`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.status() } returns DropboxStatus(available = true, connected = false, connectedAt = null)

        val response = client.get("/api/dropbox").decodeBody<DropboxStatusResponse>()

        assertTrue(response.available)
        assertEquals(false, response.connected)
        assertEquals(null, response.connectedAt)
    }

    @Test
    fun `status answers 200 with connected true and the connection time`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        val connectedAt = Instant.parse("2024-01-01T00:00:00Z")
        coEvery { dropbox.status() } returns
            DropboxStatus(available = true, connected = true, connectedAt = connectedAt)

        val response = client.get("/api/dropbox").decodeBody<DropboxStatusResponse>()

        assertEquals(true, response.connected)
        assertEquals(connectedAt.toString(), response.connectedAt)
    }

    @Test
    fun `status for an anonymous request is a json 401 without reaching the service`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = handlerApp(dropbox = dropbox)

        client.get("/api/dropbox").assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify(exactly = 0) { dropbox.status() }
    }

    // ---- authorize-url ----

    @Test
    fun `authorize-url answers 200 with the url from the service`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.authorizeUrl() } returns "https://www.dropbox.com/oauth2/authorize?client_id=app-key"

        val response = client.get("/api/dropbox/authorize-url").decodeBody<AuthorizeUrlResponse>()

        assertEquals("https://www.dropbox.com/oauth2/authorize?client_id=app-key", response.url)
    }

    @Test
    fun `authorize-url when not configured is 503 dropbox_unavailable`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.authorizeUrl() } throws ExternalSourceUnavailableException(DROPBOX_SOURCE)

        client.get("/api/dropbox/authorize-url").assertError(HttpStatusCode.ServiceUnavailable, "dropbox_unavailable")
    }

    // ---- connect ----

    @Test
    fun `connect posts the pasted code and answers 200 with the new status`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.connect(AuthorizationCode("pasted-code")) } returns
            DropboxStatus(available = true, connected = true, connectedAt = Instant.parse("2024-01-01T00:00:00Z"))

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"pasted-code"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val body = response.decodeBody<DropboxStatusResponse>()
        assertEquals(true, body.connected)
        coVerify { dropbox.connect(AuthorizationCode("pasted-code")) }
    }

    @Test
    fun `connect trims surrounding whitespace off the pasted code before validating it`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.connect(AuthorizationCode("pasted-code")) } returns
            DropboxStatus(available = true, connected = true, connectedAt = Instant.parse("2024-01-01T00:00:00Z"))

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"  pasted-code\n"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        coVerify { dropbox.connect(AuthorizationCode("pasted-code")) }
    }

    @Test
    fun `connect with a blank code is 400 validation_error without reaching the service`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"  "}""")
        }

        val error = response.assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith(AuthorizationCode.FIELD), error.message)
        // Not `coVerify(exactly = 0) { dropbox.connect(any()) }`: any()'s witness generation for a value class
        // always constructs a real instance, and AuthorizationCode's validating init would reject the blank one.
        coVerify { dropbox wasNot Called }
    }

    @Test
    fun `connect with a code dropbox rejects is 400 validation_error, not 502`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.connect(AuthorizationCode("bad-code")) } throws
            InvalidValueException(AuthorizationCode.FIELD, "was not accepted by dropbox")

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"bad-code"}""")
        }

        response.assertError(HttpStatusCode.BadRequest, "validation_error")
    }

    @Test
    fun `connect when not configured is 503 dropbox_unavailable`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.connect(AuthorizationCode("pasted-code")) } throws
            ExternalSourceUnavailableException(DROPBOX_SOURCE)

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"pasted-code"}""")
        }

        response.assertError(HttpStatusCode.ServiceUnavailable, "dropbox_unavailable")
    }

    @Test
    fun `connect on an upstream failure is 502 dropbox_error`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.connect(AuthorizationCode("pasted-code")) } throws
            ExternalSourceException(DROPBOX_SOURCE, "upstream boom")

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"pasted-code"}""")
        }

        response.assertError(HttpStatusCode.BadGateway, "dropbox_error")
    }

    @Test
    fun `connect for an anonymous request is a json 401 without reaching the service`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = handlerApp(dropbox = dropbox)

        val response = client.post("/api/dropbox/connection") {
            jsonBody("""{"code":"pasted-code"}""")
        }

        response.assertError(HttpStatusCode.Unauthorized, "unauthorized")
        coVerify { dropbox wasNot Called }
    }

    // ---- disconnect ----

    @Test
    fun `disconnect answers 204 and calls the service`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.disconnect() } just Runs

        val response = client.delete("/api/dropbox/connection")

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertEquals("", response.bodyAsText())
        coVerify { dropbox.disconnect() }
    }

    @Test
    fun `disconnect is idempotent and still answers 204 when there is nothing to disconnect`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = loggedInHandlerClient(dropbox)
        coEvery { dropbox.disconnect() } just Runs

        client.delete("/api/dropbox/connection")
        val second = client.delete("/api/dropbox/connection")

        assertEquals(HttpStatusCode.NoContent, second.status)
    }

    @Test
    fun `disconnect for an anonymous request is a json 401 without reaching the service`() = testApplication {
        val dropbox = mockk<DropboxService>()
        val client = handlerApp(dropbox = dropbox)

        client.delete("/api/dropbox/connection").assertError(HttpStatusCode.Unauthorized, "unauthorized")

        coVerify(exactly = 0) { dropbox.disconnect() }
    }
}
