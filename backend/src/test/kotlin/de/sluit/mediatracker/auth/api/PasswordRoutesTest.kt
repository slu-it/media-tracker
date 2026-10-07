package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.NewPassword
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.WrongPasswordException
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.request.put
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.just
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals

/**
 * Handler tests for `PUT /api/me/password`: [AuthService] is a MockK mock (strict), sessions live in memory, no
 * database is opened. [NewPassword]'s validating `init` makes MockK's `any()`/`match()` construct a real (here
 * invalid) instance while setting up a stub (see backend-tests.md), so every stub below passes a concrete, valid
 * `NewPassword` literal instead; its content-based `equals` (see `NewPasswordTest`) still matches the route's own
 * instance built from the request body.
 */
class PasswordRoutesTest {
    @Test
    fun `anonymous put gets json 401`() = testApplication {
        val client = handlerApp()

        val response = client.put("/api/me/password") {
            jsonBody("""{"currentPassword":"whatever","newPassword":"newpassword123"}""")
        }

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertContains(response.bodyAsText(), "\"error\":\"unauthorized\"")
    }

    @Test
    fun `changing the password with the right current password responds 204 no-store`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery {
            auth.changePassword(
                "alice",
                1L,
                any(),
                match { it.concatToString() == "oldpw" },
                NewPassword("newpassword123"),
            )
        } just Runs
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.put("/api/me/password") {
            jsonBody("""{"currentPassword":"oldpw","newPassword":"newpassword123"}""")
        }

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertEquals("no-store", response.headers[HttpHeaders.CacheControl])
    }

    @Test
    fun `wrong current password gets json 403 wrong_password`() = testApplication {
        val auth = mockk<AuthService>()
        coEvery {
            auth.changePassword("alice", 1L, any(), any(), NewPassword("newpassword123"))
        } throws WrongPasswordException()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.put("/api/me/password") {
            jsonBody("""{"currentPassword":"wrong","newPassword":"newpassword123"}""")
        }

        assertEquals(HttpStatusCode.Forbidden, response.status)
        assertEquals("wrong_password", response.decodeBody<ErrorResponse>().error)
    }

    @Test
    fun `a new password shorter than 8 characters is a validation error`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.put("/api/me/password") {
            jsonBody("""{"currentPassword":"oldpw","newPassword":"short"}""")
        }

        // auth is a strict mock with no stub for changePassword: if the route had called it regardless (i.e. if
        // the short password were not rejected before reaching the service), MockK would throw and the response
        // would be a 500, not this 400 - so this status alone is proof the service was never called.
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("validation_error", response.decodeBody<ErrorResponse>().error)
    }

    @Test
    fun `a body without newPassword is a 400 invalid_body`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.put("/api/me/password") {
            jsonBody("""{"currentPassword":"oldpw"}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("invalid_body", response.decodeBody<ErrorResponse>().error)
    }

    @Test
    fun `a malformed json body is a 400 invalid_body`() = testApplication {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth = auth)
        client.loginAsMocked(auth)

        val response = client.put("/api/me/password") {
            jsonBody("""{"currentPassword":"oldpw",""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("invalid_body", response.decodeBody<ErrorResponse>().error)
    }
}
