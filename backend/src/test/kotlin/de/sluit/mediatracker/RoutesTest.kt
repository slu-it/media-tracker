package de.sluit.mediatracker

import de.sluit.mediatracker.auth.domain.AuthService
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals

/**
 * Handler tests for the composition root `Routes.kt`: the `/api` prefix, the JSON 404 catch-all,
 * `/health` and the SPA fallback.
 */
class RoutesTest {
    @Test
    fun `health is public`() = testApplication {
        val client = handlerApp()

        val health = client.get("/health")
        assertEquals(HttpStatusCode.OK, health.status)
        assertContains(health.bodyAsText(), "\"status\":\"ok\"")
    }

    @Test
    fun `unknown api path is a json 404`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val unknownApi = client.get("/api/does-not-exist")
        assertEquals(HttpStatusCode.NotFound, unknownApi.status)
        assertEquals("""{"error":"not_found"}""", unknownApi.bodyAsText())
    }

    @Test
    fun `unknown browser path serves the spa`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val spaRoute = client.get("/lists/42")
        assertEquals(HttpStatusCode.OK, spaRoute.status)
        assertContains(spaRoute.bodyAsText(), "<div id=\"root\">")
    }

    @Test
    fun `anonymous unknown api path is a json 401 not a 404`() = testApplication {
        val client = handlerApp()

        val unknownApi = client.get("/api/does-not-exist")
        assertEquals(HttpStatusCode.Unauthorized, unknownApi.status)
        assertContains(unknownApi.bodyAsText(), "\"error\":\"unauthorized\"")
    }
}
