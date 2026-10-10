package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.decodeBody
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.GamePlatformService
import de.sluit.mediatracker.games.domain.GamePlatformSummary
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.handlerApp
import de.sluit.mediatracker.jsonBody
import de.sluit.mediatracker.loginAsMocked
import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

/** Handler tests for the editable game platforms: `POST`/`PATCH`/`DELETE /api/game-platforms` and `/api/game-platforms.summaries`. */
class GamePlatformRoutesTest {
    private val switch = Platforms.XBOX.copy(
        id = GamePlatformId(Uuid.random()),
        label = PlatformLabel("Switch 2"),
        color = HexColor("FF00FF"),
    )

    private suspend fun ApplicationTestBuilder.loggedInClient(types: GamePlatformService = mockk()): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth, gamePlatforms = types)
        client.loginAsMocked(auth)
        return client
    }

    private suspend fun HttpResponse.assertError(status: HttpStatusCode, code: String): ErrorResponse {
        assertEquals(status, this.status, bodyAsText())
        val error = decodeBody<ErrorResponse>()
        assertEquals(code, error.error)
        return error
    }

    private suspend fun HttpResponse.assertValidationError(field: String) {
        val error = assertError(HttpStatusCode.BadRequest, "validation_error")
        assertTrue(error.message!!.startsWith("$field:"), error.message)
    }

    private suspend fun HttpClient.createPlatform(body: String) = post("/api/game-platforms") { jsonBody(body) }

    private suspend fun HttpClient.patchPlatform(id: GamePlatformId, body: String) =
        patch("/api/game-platforms/$id") { jsonBody(body) }

    @Test
    fun `anonymous access to the platform endpoints is rejected with json 401`() = testApplication {
        val client = handlerApp()
        val id = GamePlatformId(Platforms.XBOX.id.value)

        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/game-platforms").status)
        assertEquals(HttpStatusCode.Unauthorized, client.patch("/api/game-platforms/$id").status)
        assertEquals(HttpStatusCode.Unauthorized, client.delete("/api/game-platforms/$id").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/game-platforms.summaries").status)
    }

    @Test
    fun `summaries returns the platforms with their game counts`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.summaries() } returns
            listOf(GamePlatformSummary(Platforms.XBOX, 3), GamePlatformSummary(switch, 0))

        val response = client.get("/api/game-platforms.summaries")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(
            listOf(
                GamePlatformSummaryResponse(Platforms.XBOX.id.toString(), "Xbox", "107C10", 3),
                GamePlatformSummaryResponse(switch.id.toString(), "Switch 2", "FF00FF", 0),
            ),
            response.decodeBody<List<GamePlatformSummaryResponse>>(),
        )
    }

    @Test
    fun `create returns 201 with a location header and trims the label and uppercases the colour`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.create(PlatformLabel("Switch 2"), HexColor("FF00FF")) } returns switch

        val response = client.createPlatform("""{"label":"  Switch 2 ","associatedColor":"ff00ff"}""")

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals("/api/game-platforms/${switch.id}", response.headers["Location"])
        assertEquals(GamePlatformResponse(switch.id.toString(), "Switch 2", "FF00FF"), response.decodeBody())
    }

    @Test
    fun `create with an invalid colour is a 400`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)

        client.createPlatform(
            """{"label":"Switch 2","associatedColor":"#FF00FF"}""",
        ).assertValidationError("associatedColor")
        client.createPlatform(
            """{"label":"Switch 2","associatedColor":"FF00F"}""",
        ).assertValidationError("associatedColor")
        client.createPlatform(
            """{"label":"Switch 2","associatedColor":"GG00FF"}""",
        ).assertValidationError("associatedColor")
    }

    @Test
    fun `create with a blank or too long label is a 400`() = testApplication {
        val client = loggedInClient()

        client.createPlatform("""{"label":"   ","associatedColor":"FF00FF"}""").assertValidationError("label")
        client.createPlatform(
            """{"label":"${"x".repeat(65)}","associatedColor":"FF00FF"}""",
        ).assertValidationError("label")
    }

    @Test
    fun `create without a colour is a 400 invalid_body`() = testApplication {
        val client = loggedInClient()

        client.createPlatform("""{"label":"Switch 2"}""").assertError(HttpStatusCode.BadRequest, "invalid_body")
    }

    @Test
    fun `create with a taken label is a 409 name_taken with the existing entry`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.create(PlatformLabel("xbox"), HexColor("FF00FF")) } throws
            NameTakenException("game platform", Platforms.XBOX.id.toString(), "Xbox")

        val error = client.createPlatform("""{"label":"xbox","associatedColor":"FF00FF"}""")
            .assertError(HttpStatusCode.Conflict, "name_taken")

        assertEquals(Platforms.XBOX.id.toString(), error.existingId)
        assertEquals("Xbox", error.existingName)
    }

    @Test
    fun `patch with a label only passes a null colour`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.update(switch.id, PlatformLabel("Switch 2"), null) } returns switch

        val response = client.patchPlatform(switch.id, """{"label":"Switch 2"}""")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals(GamePlatformResponse(switch.id.toString(), "Switch 2", "FF00FF"), response.decodeBody())
    }

    @Test
    fun `patch with a colour only passes a null label and the uppercased colour`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.update(switch.id, null, HexColor("ABCDEF")) } returns switch

        assertEquals(HttpStatusCode.OK, client.patchPlatform(switch.id, """{"associatedColor":"abcdef"}""").status)
        coVerify { types.update(switch.id, null, HexColor("ABCDEF")) }
    }

    @Test
    fun `patch with an empty body is a 400`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)

        client.patchPlatform(switch.id, "{}").assertValidationError("label")
        client.patchPlatform(switch.id, """{"label":null}""").assertValidationError("label")
    }

    @Test
    fun `patch with an invalid value is a 400`() = testApplication {
        val client = loggedInClient()

        client.patchPlatform(switch.id, """{"associatedColor":"nope"}""").assertValidationError("associatedColor")
        client.patchPlatform(switch.id, """{"label":" "}""").assertValidationError("label")
        client.patch("/api/game-platforms/not-a-uuid") {
            jsonBody("""{"label":"x"}""")
        }.assertValidationError("platformIds")
    }

    @Test
    fun `patch of an unknown platform is 404`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.update(switch.id, PlatformLabel("x"), null) } throws
            NotFoundException("game platform", switch.id.toString())

        client.patchPlatform(switch.id, """{"label":"x"}""").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `patch onto a taken label is a 409 name_taken with the existing entry`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.update(switch.id, PlatformLabel("Xbox"), null) } throws
            NameTakenException("game platform", Platforms.XBOX.id.toString(), "Xbox")

        val error = client.patchPlatform(switch.id, """{"label":"Xbox"}""")
            .assertError(HttpStatusCode.Conflict, "name_taken")

        assertEquals(Platforms.XBOX.id.toString(), error.existingId)
        assertEquals("Xbox", error.existingName)
    }

    @Test
    fun `delete returns 204`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.delete(switch.id) } just Runs

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/game-platforms/${switch.id}").status)
        coVerify { types.delete(switch.id) }
    }

    @Test
    fun `delete of an unknown platform is 404`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.delete(switch.id) } throws NotFoundException("game platform", switch.id.toString())

        client.delete("/api/game-platforms/${switch.id}").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `delete of a platform still in use is a 409 conflict`() = testApplication {
        val types = mockk<GamePlatformService>()
        val client = loggedInClient(types)
        coEvery { types.delete(switch.id) } throws ConflictException("game platform", switch.id.toString())

        client.delete("/api/game-platforms/${switch.id}").assertError(HttpStatusCode.Conflict, "conflict")
    }
}
