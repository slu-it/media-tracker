package de.sluit.mediatracker

import de.sluit.mediatracker.auth.PasswordHasher
import de.sluit.mediatracker.auth.UserRepository
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.http.parameters
import io.ktor.server.config.ApplicationConfig
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class LoginFlowTest {

    /** Boots the real module against H2 and seeds one user. */
    private fun ApplicationTestBuilder.appWithUser(username: String, password: String): HttpClient {
        environment { config = ApplicationConfig("application-test.yaml") }
        application {
            module()
            transaction {
                val users = UserRepository()
                if (users.findByUsernameBlocking(username) == null) {
                    users.createBlocking(username, PasswordHasher(memoryKb = 1024, iterations = 1).hash(password))
                }
            }
        }
        return createClient {
            followRedirects = false
            install(HttpCookies)
        }
    }

    @Test
    fun `anonymous browser navigation is redirected to login`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")

        val root = client.get("/")
        assertEquals(HttpStatusCode.Found, root.status)
        assertEquals("/login", root.headers["Location"])

        val login = client.get("/login")
        assertEquals(HttpStatusCode.OK, login.status)
        assertContains(login.bodyAsText(), "<form method=\"post\" action=\"/login\"")
        assertFalse(login.bodyAsText().contains("Wrong username or password"))
    }

    @Test
    fun `anonymous api call gets json 401`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")

        val me = client.get("/api/me")
        assertEquals(HttpStatusCode.Unauthorized, me.status)
        assertContains(me.bodyAsText(), "\"error\":\"unauthorized\"")
    }

    @Test
    fun `health is public`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")
        val health = client.get("/health")
        assertEquals(HttpStatusCode.OK, health.status)
        assertContains(health.bodyAsText(), "\"status\":\"ok\"")
    }

    @Test
    fun `wrong password redirects back with error flag`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")

        val response = client.submitForm(
            "/login",
            parameters {
                append("username", "alice")
                append("password", "nope")
            },
        )
        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/login?error=1", response.headers["Location"])

        val page = client.get("/login?error=1")
        assertContains(page.bodyAsText(), "Wrong username or password")
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/me").status)
    }

    @Test
    fun `login creates a session, api works, logout invalidates it`() = testApplication {
        val client = appWithUser("alice", "wonderland-1")

        val login = client.submitForm(
            "/login",
            parameters {
                append("username", "alice")
                append("password", "wonderland-1")
            },
        )
        assertEquals(HttpStatusCode.Found, login.status)
        assertEquals("/", login.headers["Location"])
        val setCookie = login.headers["Set-Cookie"] ?: error("no session cookie set")
        assertContains(setCookie, "MT_SESSION=")
        assertContains(setCookie, "HttpOnly")
        assertContains(setCookie, "SameSite=Lax")

        val me = client.get("/api/me")
        assertEquals(HttpStatusCode.OK, me.status)
        assertEquals("""{"username":"alice"}""", me.bodyAsText())

        // Logged-in users are bounced away from the login page.
        assertEquals(HttpStatusCode.Found, client.get("/login").status)

        // Unknown API paths are JSON 404s, not the SPA fallback; unknown browser paths are the SPA.
        val unknownApi = client.get("/api/does-not-exist")
        assertEquals(HttpStatusCode.NotFound, unknownApi.status)
        assertEquals("""{"error":"not_found"}""", unknownApi.bodyAsText())
        val spaRoute = client.get("/lists/42")
        assertEquals(HttpStatusCode.OK, spaRoute.status)
        assertContains(spaRoute.bodyAsText(), "<div id=\"root\">")

        val logout = client.post("/logout")
        assertEquals(HttpStatusCode.Found, logout.status)
        assertEquals("/login", logout.headers["Location"])

        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/me").status)
    }
}
