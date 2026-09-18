package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.parameters
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Handler tests for the login/logout/me routes and the Sessions/Security plugins: [AuthService] is a
 * MockK mock, sessions live in memory, no database is opened.
 */
class AuthRoutesTest {
    @Test
    fun `anonymous browser navigation is redirected to login`() = testApplication {
        val client = handlerApp()

        val root = client.get("/")
        assertEquals(HttpStatusCode.Found, root.status)
        assertEquals("/login", root.headers["Location"])
    }

    @Test
    fun `anonymous api call gets json 401`() = testApplication {
        val client = handlerApp()

        val me = client.get("/api/me")
        assertEquals(HttpStatusCode.Unauthorized, me.status)
        assertContains(me.bodyAsText(), "\"error\":\"unauthorized\"")
    }

    @Test
    fun `login page renders the form without an error banner`() = testApplication {
        val client = handlerApp()

        val login = client.get("/login")
        assertEquals(HttpStatusCode.OK, login.status)
        assertContains(login.bodyAsText(), "<form method=\"post\" action=\"/login\"")
        assertFalse(login.bodyAsText().contains("Wrong username or password"))
    }

    @Test
    fun `login page shows the error banner when flagged`() = testApplication {
        val client = handlerApp()

        val page = client.get("/login?error=1")
        assertContains(page.bodyAsText(), "Wrong username or password")
    }

    @Test
    fun `login stylesheet is served publicly as text css`() = testApplication {
        val client = handlerApp()

        val css = client.get("/login/static/login.css")
        assertEquals(HttpStatusCode.OK, css.status)
        assertEquals(ContentType.Text.CSS, css.contentType()?.withoutParameters())
        assertTrue(css.bodyAsText().isNotEmpty())
        assertContains(css.bodyAsText(), ":root")
    }

    @Test
    fun `blank credentials redirect back with error flag without asking the service`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)

        val response = client.submitForm(
            "/login",
            parameters {
                append("username", "")
                append("password", "")
            },
        )

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/login?error=1", response.headers["Location"])
        coVerify(exactly = 0) { auth.login(any(), any()) }
    }

    @Test
    fun `rejected credentials redirect back with error flag`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery { auth.login("alice", any()) } returns null
        val client = handlerApp(auth = auth)

        val response = client.submitForm(
            "/login",
            parameters {
                append("username", "alice")
                append("password", "nope")
            },
        )

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/login?error=1", response.headers["Location"])
    }

    @Test
    fun `failed login does not set a session cookie`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery { auth.login("alice", any()) } returns null
        val client = handlerApp(auth = auth)

        val response = client.submitForm(
            "/login",
            parameters {
                append("username", "alice")
                append("password", "nope")
            },
        )

        assertNull(response.headers["Set-Cookie"])
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/me").status)
    }

    @Test
    fun `login passes the submitted username and password to the service`() = testApplication {
        val auth = mockk<AuthService>()
        val user = User(id = 1L, username = "alice", passwordHash = "irrelevant")
        coEvery { auth.login("alice", match { it.concatToString() == "wonderland-1" }) } returns user
        val client = handlerApp(auth = auth)

        val response = client.submitForm(
            "/login",
            parameters {
                append("username", "alice")
                append("password", "wonderland-1")
            },
        )

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/", response.headers["Location"])
    }

    @Test
    fun `successful login sets a hardened session cookie and redirects to the app`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)

        val login = client.loginAsMocked(auth)

        val setCookie = login.headers["Set-Cookie"] ?: error("no session cookie set")
        assertContains(setCookie, "MT_SESSION=")
        assertContains(setCookie, "HttpOnly")
        assertContains(setCookie, "SameSite=Lax")
    }

    @Test
    fun `logged in user can read api me`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val me = client.get("/api/me")
        assertEquals(HttpStatusCode.OK, me.status)
        assertEquals("alice", me.decodeBody<MeResponse>().username)
    }

    @Test
    fun `logged in user is bounced away from the login page`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        assertEquals(HttpStatusCode.Found, client.get("/login").status)
    }

    @Test
    fun `logout invalidates the session`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val logout = client.post("/logout")
        assertEquals(HttpStatusCode.Found, logout.status)
        assertEquals("/login", logout.headers["Location"])

        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/me").status)
    }
}
