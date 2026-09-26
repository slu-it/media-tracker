package de.sluit.mediatracker.dropbox.integration

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.config.DropboxConfig
import de.sluit.mediatracker.dropbox.domain.AuthorizationCode
import de.sluit.mediatracker.dropbox.domain.DropboxInvalidGrantException
import de.sluit.mediatracker.dropbox.domain.DropboxUnauthorizedException
import de.sluit.mediatracker.dropbox.domain.RefreshToken
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import java.io.IOException
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours

/**
 * Adapter-level tests for [DropboxHttpApi]: this is the dropbox domain's equivalent of a repository test,
 * exercised against [MockEngine] instead of the real Dropbox API, modelled on
 * `games/integration/SteamGridDbCoverSourceTest.kt`.
 */
class DropboxHttpApiTest {
    private val config = DropboxConfig(
        appKey = "app-key",
        appSecret = "app-secret",
        apiBaseUrl = "https://dropbox-api.example",
        contentBaseUrl = "https://dropbox-content.example",
    )

    private fun apiWith(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): DropboxHttpApi {
        val client = HttpClient(MockEngine(handler)) {
            expectSuccess = false
            install(ContentNegotiation) {
                json(dropboxJson)
            }
        }
        return DropboxHttpApi(client, config)
    }

    private fun MockRequestHandleScope.jsonResponse(status: HttpStatusCode, body: String): HttpResponseData =
        respond(content = body, status = status, headers = headersOf(HttpHeaders.ContentType, "application/json"))

    private fun MockRequestHandleScope.textResponse(status: HttpStatusCode, body: String): HttpResponseData =
        respond(content = body, status = status, headers = headersOf(HttpHeaders.ContentType, "text/plain"))

    private suspend fun HttpRequestData.formBody(): String = body.toByteArray().toString(Charsets.UTF_8)

    // ---- token exchange ----

    @Test
    fun `exchangeCode sends basic auth and the authorization_code grant`() = runBlocking {
        var seenAuth: String? = null
        var seenBody: String? = null
        var seenUrl: String? = null
        val api = apiWith { request ->
            seenAuth = request.headers[HttpHeaders.Authorization]
            seenBody = request.formBody()
            seenUrl = request.url.toString()
            jsonResponse(HttpStatusCode.OK, """{"access_token":"a1","expires_in":14400,"refresh_token":"r1"}""")
        }

        val grant = api.exchangeCode(AuthorizationCode("pasted-code"))

        val expectedAuth = "Basic " + Base64.getEncoder().encodeToString("app-key:app-secret".toByteArray())
        assertEquals(expectedAuth, seenAuth)
        assertEquals("https://dropbox-api.example/oauth2/token", seenUrl)
        assertTrue(seenBody!!.contains("grant_type=authorization_code"), seenBody)
        assertTrue(seenBody.contains("code=pasted-code"), seenBody)
        assertEquals("a1", grant.accessToken)
        assertEquals(RefreshToken("r1"), grant.refreshToken)
        assertEquals(4.hours, grant.expiresIn)
    }

    @Test
    fun `exchangeCode without a refresh token in the response throws an external source exception`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.OK, """{"access_token":"a1","expires_in":14400}""")
            }

            assertFailsWith<ExternalSourceException> { api.exchangeCode(AuthorizationCode("pasted-code")) }
        }
    }

    @Test
    fun `exchangeCode on an invalid_grant error throws DropboxInvalidGrantException`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.BadRequest, """{"error":"invalid_grant","error_description":"bad code"}""")
            }

            assertFailsWith<DropboxInvalidGrantException> { api.exchangeCode(AuthorizationCode("pasted-code")) }
        }
    }

    @Test
    fun `exchangeCode on a non-invalid_grant 400 includes the error body in the exception message`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(
                    HttpStatusCode.BadRequest,
                    """{"error":"invalid_client","error_description":"client id mismatch"}""",
                )
            }

            val exception = assertFailsWith<ExternalSourceException> {
                api.exchangeCode(AuthorizationCode("pasted-code"))
            }

            assertTrue(exception.message!!.contains("client id mismatch"), exception.message)
        }
    }

    @Test
    fun `exchangeCode on a 500 throws an external source exception without leaking the app secret`() = runBlocking {
        val api = apiWith {
            jsonResponse(HttpStatusCode.InternalServerError, "Internal Server Error")
        }

        val exception = assertFailsWith<ExternalSourceException> {
            api.exchangeCode(AuthorizationCode("pasted-code"))
        }

        assertEquals("dropbox", exception.source)
        assertFalse(exception.message!!.contains("app-secret"))
    }

    @Test
    fun `exchangeCode wraps an io exception thrown while talking to the upstream`() {
        runBlocking {
            val api = apiWith {
                throw IOException("connection reset")
            }

            assertFailsWith<ExternalSourceException> { api.exchangeCode(AuthorizationCode("pasted-code")) }
        }
    }

    @Test
    fun `exchangeCode on an oversized refresh token throws an external source exception, not a validation error`() {
        runBlocking {
            val oversized = "r".repeat(RefreshToken.MAX_LENGTH + 1)
            val api = apiWith {
                jsonResponse(
                    HttpStatusCode.OK,
                    """{"access_token":"a1","expires_in":14400,"refresh_token":"$oversized"}""",
                )
            }

            assertFailsWith<ExternalSourceException> { api.exchangeCode(AuthorizationCode("pasted-code")) }
        }
    }

    @Test
    fun `a malformed token response never leaks a token substring anywhere in the exception's cause chain`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(
                    HttpStatusCode.OK,
                    """{"access_token":"super-secret-access-token","expires_in":"not-a-number"}""",
                )
            }

            val exception = assertFailsWith<ExternalSourceException> {
                api.exchangeCode(AuthorizationCode("pasted-code"))
            }

            val chain = generateSequence<Throwable>(exception) { it.cause }.toList()
            val chainText = chain.joinToString("\n") { "${it::class.simpleName}: ${it.message}" }
            assertFalse(chainText.contains("super-secret-access-token"), chainText)
        }
    }

    // ---- refresh ----

    @Test
    fun `refresh sends the refresh_token grant and does not require a refresh token in the response`() = runBlocking {
        var seenBody: String? = null
        val api = apiWith { request ->
            seenBody = request.formBody()
            jsonResponse(HttpStatusCode.OK, """{"access_token":"a2","expires_in":14400}""")
        }

        val grant = api.refresh(RefreshToken("r1"))

        assertTrue(seenBody!!.contains("grant_type=refresh_token"), seenBody)
        assertTrue(seenBody.contains("refresh_token=r1"), seenBody)
        assertEquals("a2", grant.accessToken)
        assertEquals(4.hours, grant.expiresIn)
    }

    @Test
    fun `refresh on invalid_grant throws DropboxInvalidGrantException`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.BadRequest, """{"error":"invalid_grant"}""")
            }

            assertFailsWith<DropboxInvalidGrantException> { api.refresh(RefreshToken("r1")) }
        }
    }

    // ---- revoke ----

    @Test
    fun `revoke sends the bearer token to the revoke endpoint`() = runBlocking {
        var seenAuth: String? = null
        var seenUrl: String? = null
        val api = apiWith { request ->
            seenAuth = request.headers[HttpHeaders.Authorization]
            seenUrl = request.url.toString()
            respond(content = "null", status = HttpStatusCode.OK)
        }

        api.revoke("access-1")

        assertEquals("Bearer access-1", seenAuth)
        assertEquals("https://dropbox-api.example/2/auth/token/revoke", seenUrl)
    }

    @Test
    fun `revoke on a failure throws an external source exception`() {
        runBlocking {
            val api = apiWith {
                respond(content = "boom", status = HttpStatusCode.InternalServerError)
            }

            assertFailsWith<ExternalSourceException> { api.revoke("access-1") }
        }
    }

    @Test
    fun `revoke redacts an access token found in the response body, in the message and the cause chain`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.BadRequest, """{"error_summary":"bad","access_token":"sl.secret"}""")
            }

            val exception = assertFailsWith<ExternalSourceException> { api.revoke("access-1") }

            val message = exception.message!!
            assertFalse(message.contains("sl.secret"), message)
            assertTrue(message.contains("***"), message)
            val chain = generateSequence<Throwable>(exception) { it.cause }.toList()
            val chainText = chain.joinToString("\n") { "${it::class.simpleName}: ${it.message}" }
            assertFalse(chainText.contains("sl.secret"), chainText)
        }
    }

    @Test
    fun `revoke truncates a long response body in the exception message`() {
        runBlocking {
            // "z" does not occur anywhere in the fixed "dropbox revoke returned status 500: " prefix, so every
            // occurrence in the message comes from the (possibly truncated) body.
            val api = apiWith {
                respond(content = "z".repeat(500), status = HttpStatusCode.InternalServerError)
            }

            val exception = assertFailsWith<ExternalSourceException> { api.revoke("access-1") }

            val message = exception.message!!
            assertTrue(message.contains("…"), message)
            assertEquals(300, message.count { it == 'z' })
        }
    }

    // ---- upload ----

    @Test
    fun `upload sends the Dropbox-API-Arg header and the octet-stream body`() = runBlocking {
        var seenArg: String? = null
        var seenContentType: String? = null
        var seenAuth: String? = null
        var seenBody: ByteArray? = null
        val api = apiWith { request ->
            seenArg = request.headers["Dropbox-API-Arg"]
            // Content-Type is a property of the outgoing body, not a header MockEngine exposes via `headers`.
            seenContentType = request.body.contentType.toString()
            seenAuth = request.headers[HttpHeaders.Authorization]
            seenBody = request.body.toByteArray()
            jsonResponse(HttpStatusCode.OK, """{"server_modified":"2024-01-02T03:04:05Z","size":42}""")
        }

        val stored = api.upload("access-1", "/backup/full-export.json", byteArrayOf(1, 2, 3))

        assertEquals("Bearer access-1", seenAuth)
        assertEquals(
            """{"path":"/backup/full-export.json","mode":"overwrite","autorename":false,"mute":true}""",
            seenArg,
        )
        assertTrue(seenContentType!!.startsWith("application/octet-stream"), seenContentType)
        assertEquals(listOf<Byte>(1, 2, 3), seenBody!!.toList())
        assertEquals("/backup/full-export.json", stored.path)
        assertEquals(42L, stored.sizeBytes)
    }

    @Test
    fun `upload escapes non-ascii characters in the Dropbox-API-Arg header`() = runBlocking {
        var seenArg: String? = null
        val api = apiWith { request ->
            seenArg = request.headers["Dropbox-API-Arg"]
            jsonResponse(HttpStatusCode.OK, """{"server_modified":"2024-01-02T03:04:05Z","size":1}""")
        }

        api.upload("access-1", "/bäckup/full-export.json", byteArrayOf(1))

        assertTrue(seenArg!!.none { it.code > 127 }, seenArg)
        assertTrue(seenArg!!.contains("\\u00e4"), seenArg)
    }

    @Test
    fun `upload on a 401 throws DropboxUnauthorizedException`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.Unauthorized, """{"error_summary":"expired_access_token/"}""")
            }

            assertFailsWith<DropboxUnauthorizedException> {
                api.upload("access-1", "/backup/full-export.json", byteArrayOf(1))
            }
        }
    }

    @Test
    fun `upload on a 500 throws an external source exception`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.InternalServerError, "boom")
            }

            assertFailsWith<ExternalSourceException> {
                api.upload("access-1", "/backup/full-export.json", byteArrayOf(1))
            }
        }
    }

    @Test
    fun `upload on a 400 includes the response body in the exception message`() {
        runBlocking {
            val api = apiWith {
                textResponse(
                    HttpStatusCode.BadRequest,
                    """Error in call to API function "files/upload": invalid path""",
                )
            }

            val exception = assertFailsWith<ExternalSourceException> {
                api.upload("access-1", "/backup/full-export.json", byteArrayOf(1))
            }

            assertTrue(exception.message!!.contains("invalid path"), exception.message)
        }
    }

    @Test
    fun `upload with a malformed server_modified timestamp throws an external source exception, not a 500`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.OK, """{"server_modified":"not-a-timestamp","size":1}""")
            }

            assertFailsWith<ExternalSourceException> {
                api.upload("access-1", "/backup/full-export.json", byteArrayOf(1))
            }
        }
    }

    // ---- get_metadata ----

    @Test
    fun `getMetadata returns the file metadata on success`() = runBlocking {
        val api = apiWith {
            jsonResponse(HttpStatusCode.OK, """{"server_modified":"2024-01-02T03:04:05Z","size":7}""")
        }

        val stored = api.getMetadata("access-1", "/backup/full-export.json")

        assertEquals("/backup/full-export.json", stored?.path)
        assertEquals(7L, stored?.sizeBytes)
    }

    @Test
    fun `getMetadata on a 409 path not_found returns null`() = runBlocking {
        val api = apiWith {
            jsonResponse(
                HttpStatusCode.Conflict,
                """{"error_summary":"path/not_found/..","error":{".tag":"path"}}""",
            )
        }

        assertNull(api.getMetadata("access-1", "/backup/full-export.json"))
    }

    @Test
    fun `getMetadata on a 409 with a different reason throws an external source exception`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.Conflict, """{"error_summary":"some_other_reason/.."}""")
            }

            assertFailsWith<ExternalSourceException> { api.getMetadata("access-1", "/backup/full-export.json") }
        }
    }

    @Test
    fun `getMetadata on a 400 includes the response body in the exception message`() {
        runBlocking {
            val api = apiWith {
                textResponse(
                    HttpStatusCode.BadRequest,
                    """Error in call to API function "files/get_metadata": missing required field "path"""",
                )
            }

            val exception = assertFailsWith<ExternalSourceException> {
                api.getMetadata("access-1", "/backup/full-export.json")
            }

            assertTrue(exception.message!!.contains("missing required field"), exception.message)
        }
    }

    @Test
    fun `getMetadata on a 401 throws DropboxUnauthorizedException`() {
        runBlocking {
            val api = apiWith {
                jsonResponse(HttpStatusCode.Unauthorized, """{"error_summary":"expired_access_token/"}""")
            }

            assertFailsWith<DropboxUnauthorizedException> { api.getMetadata("access-1", "/backup/full-export.json") }
        }
    }

    @Test
    fun `getMetadata sends the path as a json body`() = runBlocking {
        var seenBody: String? = null
        val api = apiWith { request ->
            seenBody = request.formBody()
            jsonResponse(HttpStatusCode.OK, """{"server_modified":"2024-01-02T03:04:05Z","size":1}""")
        }

        api.getMetadata("access-1", "/backup/full-export.json")

        assertEquals("""{"path":"/backup/full-export.json"}""", seenBody)
    }
}
