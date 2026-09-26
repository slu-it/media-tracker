package de.sluit.mediatracker

import de.sluit.mediatracker.auth.api.ApiKeysResponse
import de.sluit.mediatracker.dropbox.api.DropboxStatusResponse
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * Smoke test of the composition root: the real `module()` on the Testcontainers MariaDB shared by the test
 * JVM ([appWithUser]), a real user with a real Argon2id hash, real
 * [de.sluit.mediatracker.auth.api.DbSessionStorage]; happy paths only, everything
 * negative lives in [de.sluit.mediatracker.auth.api.AuthRoutesTest] and [RoutesTest]. The exception is the 401 on
 * `/api/me` after logout, kept here deliberately as the only end-to-end proof that the session row is really gone;
 * every other negative path lives in the handler tests.
 */
class ApplicationSmokeTest {
    @Test
    fun `login with the stored password sets a session cookie and redirects to the app`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")

        val login = client.loginAs("alice", "wonderland-1")

        assertContains(login.headers["Set-Cookie"] ?: error("no session cookie set"), "MT_SESSION=")
    }

    @Test
    fun `the session cookie authorises api me with the username`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")
        client.loginAs("alice", "wonderland-1")

        val me = client.get("/api/me")
        assertEquals(HttpStatusCode.OK, me.status)
        assertEquals("""{"username":"alice"}""", me.bodyAsText())
    }

    @Test
    fun `logout ends the session`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")
        client.loginAs("alice", "wonderland-1")

        val logout = client.post("/logout")
        assertEquals(HttpStatusCode.Found, logout.status)
        assertEquals("/login", logout.headers["Location"])

        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/me").status)
    }

    @Test
    fun `regenerating and reading back the primary api key round trips through the real stack`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")
        client.loginAs("alice", "wonderland-1")

        val regenerated = client.post("/api/me/api-keys/primary")
        assertEquals(HttpStatusCode.OK, regenerated.status)
        val primary = regenerated.decodeBody<ApiKeysResponse>().primary
        assertFalse(primary.isNullOrBlank())

        val read = client.get("/api/me/api-keys")
        assertEquals(HttpStatusCode.OK, read.status)
        assertEquals(primary, read.decodeBody<ApiKeysResponse>().primary)
    }

    @Test
    fun `health reports ok`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")

        val health = client.get("/health")
        assertEquals(HttpStatusCode.OK, health.status)
        assertContains(health.bodyAsText(), "\"status\":\"ok\"")
    }

    @Test
    fun `the spa is served at the root to a logged in user`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")
        client.loginAs("alice", "wonderland-1")

        val root = client.get("/")
        assertEquals(HttpStatusCode.OK, root.status)
        assertContains(root.bodyAsText(), "<div id=\"root\">")
    }

    @Test
    fun `dropbox status reports unavailable since application-test yaml pins the app key and secret empty`() =
        testApplication {
            val client = appWithUser("alice", "wonderland-1")
            client.loginAs("alice", "wonderland-1")

            val response = client.get("/api/dropbox")

            assertEquals(HttpStatusCode.OK, response.status)
            val status = response.decodeBody<DropboxStatusResponse>()
            assertFalse(status.available)
            assertFalse(status.connected)
        }
}
