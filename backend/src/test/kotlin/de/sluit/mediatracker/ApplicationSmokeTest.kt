package de.sluit.mediatracker

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals

/**
 * Smoke test of the composition root: the real `module()` on H2 ([appWithUser]), a real user with a real
 * Argon2id hash, real [de.sluit.mediatracker.auth.api.DbSessionStorage]; happy paths only, everything
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
}
