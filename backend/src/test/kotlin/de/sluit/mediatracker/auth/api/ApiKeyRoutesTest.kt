package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.ApiKey
import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.ApiKeySlot
import de.sluit.mediatracker.auth.domain.ApiKeys
import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals

/**
 * Handler tests for `/api/me/api-keys`: [ApiKeyService] is a MockK mock (strict), sessions live in memory,
 * no database is opened.
 */
class ApiKeyRoutesTest {
    @Test
    fun `anonymous get on api keys gets json 401`() = testApplication {
        val client = handlerApp()

        val response = client.get("/api/me/api-keys")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertContains(response.bodyAsText(), "\"error\":\"unauthorized\"")
    }

    @Test
    fun `get returns both slots as explicit nulls when unset`() = testApplication {
        val auth = mockk<AuthService>()
        val apiKeys = mockk<ApiKeyService>()
        coEvery { apiKeys.keysFor(1L) } returns ApiKeys(primary = null, secondary = null)
        val client = handlerApp(auth = auth, apiKeys = apiKeys)
        client.loginAsMocked(auth)

        val response = client.get("/api/me/api-keys")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("no-store", response.headers[HttpHeaders.CacheControl])
        assertContains(response.bodyAsText(), "\"primary\":null")
        assertContains(response.bodyAsText(), "\"secondary\":null")
    }

    @Test
    fun `get returns the stored key strings when set`() = testApplication {
        val auth = mockk<AuthService>()
        val apiKeys = mockk<ApiKeyService>()
        val primary = ApiKey.generate()
        val secondary = ApiKey.generate()
        coEvery { apiKeys.keysFor(1L) } returns ApiKeys(primary = primary, secondary = secondary)
        val client = handlerApp(auth = auth, apiKeys = apiKeys)
        client.loginAsMocked(auth)

        val response = client.get("/api/me/api-keys")

        val body = response.decodeBody<ApiKeysResponse>()
        assertEquals(primary.toString(), body.primary)
        assertEquals(secondary.toString(), body.secondary)
    }

    @Test
    fun `post primary regenerates the primary slot`() = testApplication {
        val auth = mockk<AuthService>()
        val apiKeys = mockk<ApiKeyService>()
        coEvery { apiKeys.regenerate(1L, ApiKeySlot.PRIMARY) } returns
            ApiKeys(primary = ApiKey.generate(), secondary = null)
        val client = handlerApp(auth = auth, apiKeys = apiKeys)
        client.loginAsMocked(auth)

        val response = client.post("/api/me/api-keys/primary")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify { apiKeys.regenerate(1L, ApiKeySlot.PRIMARY) }
    }

    @Test
    fun `post secondary regenerates the secondary slot`() = testApplication {
        val auth = mockk<AuthService>()
        val apiKeys = mockk<ApiKeyService>()
        coEvery { apiKeys.regenerate(1L, ApiKeySlot.SECONDARY) } returns
            ApiKeys(primary = null, secondary = ApiKey.generate())
        val client = handlerApp(auth = auth, apiKeys = apiKeys)
        client.loginAsMocked(auth)

        val response = client.post("/api/me/api-keys/secondary")

        assertEquals(HttpStatusCode.OK, response.status)
        coVerify { apiKeys.regenerate(1L, ApiKeySlot.SECONDARY) }
    }

    @Test
    fun `post an unknown slot is a validation error`() = testApplication {
        val auth = mockk<AuthService>()
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(auth = auth, apiKeys = apiKeys)
        client.loginAsMocked(auth)

        val response = client.post("/api/me/api-keys/tertiary")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("validation_error", response.decodeBody<ErrorResponse>().error)
    }

    @Test
    fun `an api key header alone does not authenticate the session gated api me`() = testApplication {
        val apiKeys = mockk<ApiKeyService>()
        val client = handlerApp(apiKeys = apiKeys)

        val response = client.get("/api/me") { header(API_KEY_HEADER, "whatever") }

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        coVerify(exactly = 0) { apiKeys.authenticate(any()) }
    }
}
