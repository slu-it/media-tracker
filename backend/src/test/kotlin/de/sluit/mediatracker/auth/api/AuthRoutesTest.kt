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
import io.ktor.http.encodeURLParameter
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
        assertContains(login.bodyAsText(), "<form method=\"post\" autocomplete=\"on\"")
        assertFalse(login.bodyAsText().contains("Wrong username or password"))
    }

    @Test
    fun `login page shows the error banner when flagged`() = testApplication {
        val client = handlerApp()

        val page = client.get("/login?error=1")
        assertContains(page.bodyAsText(), "Wrong username or password")
    }

    @Test
    fun `login page reads the shared color mode key`() = testApplication {
        // Guards against the inline mode script drifting away from frontend/src/theme/mode.ts unnoticed:
        // both read the same "mt.mode" localStorage key to apply light/dark mode before first paint.
        val client = handlerApp()

        val login = client.get("/login")
        assertEquals(HttpStatusCode.OK, login.status)
        assertContains(login.bodyAsText(), """localStorage.getItem("mt.mode")""")
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

    private suspend fun io.ktor.client.HttpClient.postLogin(url: String, password: String = "pw") = submitForm(
        url,
        parameters {
            append("username", "alice")
            append("password", password)
        },
    )

    private fun returnToOf(location: String?): String? =
        io.ktor.http.Url(location ?: error("no location")).parameters["returnTo"]

    @Test
    fun `anonymous deep link is redirected to login with the encoded return target`() = testApplication {
        val client = handlerApp()

        val response = client.get("/games/watchlist?search=zelda&page=2")

        assertEquals(HttpStatusCode.Found, response.status)
        val location = response.headers["Location"]
        assertTrue(location!!.startsWith("/login?returnTo="))
        assertEquals("/games/watchlist?search=zelda&page=2", returnToOf(location))
    }

    @Test
    fun `successful login with a return target redirects there`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery { auth.login("alice", any()) } returns User(id = 1L, username = "alice", passwordHash = "x")
        val client = handlerApp(auth = auth)

        val response = client.postLogin("/login?returnTo=%2Fgames%2Fwatchlist%3Fsearch%3Dzelda")

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/games/watchlist?search=zelda", response.headers["Location"])
    }

    @Test
    fun `unsafe return targets fall back to the app root after login`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery { auth.login("alice", any()) } returns User(id = 1L, username = "alice", passwordHash = "x")
        val client = handlerApp(auth = auth)

        for (bad in listOf("//evil.example", "https://evil.example", "/\\evil.example", "/login", "/logout")) {
            val response = client.postLogin("/login?returnTo=" + bad.encodeURLParameter())
            assertEquals("/", response.headers["Location"], bad)
        }
    }

    @Test
    fun `failed login keeps the return target`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery { auth.login("alice", any()) } returns null
        val client = handlerApp(auth = auth)

        val response = client.postLogin("/login?returnTo=%2Fgames%2Franking")

        val location = response.headers["Location"]
        assertTrue(location!!.startsWith("/login?error=1&returnTo="))
        assertEquals("/games/ranking", returnToOf(location))
    }

    @Test
    fun `logged in bounce from the login page goes to the return target`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.get("/login?returnTo=/games/ranking")

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/games/ranking", response.headers["Location"])
    }

    @Test
    fun `logged in bounce ignores an unsafe return target`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.get("/login?$RETURN_TO_PARAM=//evil.example")

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/", response.headers["Location"])
    }

    @Test
    fun `anonymous request with a raw non-ascii path is redirected to plain login`() = testApplication {
        val client = handlerApp()

        val response = client.get("/games/\u00fc")

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals("/login", response.headers["Location"])
    }

    @Test
    fun `anonymous request keeps the percent-encoded raw uri as returnTo`() = testApplication {
        val client = handlerApp()
        val uri = "/games/overview?search=%C3%BCber&platform=00000000-0000-4000-8000-000000000002"

        val response = client.get(uri)

        assertEquals(HttpStatusCode.Found, response.status)
        assertEquals(uri, returnToOf(response.headers["Location"]))
    }
}
