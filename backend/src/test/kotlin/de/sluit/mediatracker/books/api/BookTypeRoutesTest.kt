package de.sluit.mediatracker.books.api

import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.books.BookTypes
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.books.domain.BookTypeService
import de.sluit.mediatracker.books.domain.BookTypeSummary
import de.sluit.mediatracker.common.api.ErrorResponse
import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.decodeBody
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

/** Handler tests for the editable book types: `POST`/`PATCH`/`DELETE /api/book-types` and `/api/book-types.summaries`. */
class BookTypeRoutesTest {
    private val comic = BookTypes.KINDLE.copy(
        id = BookTypeId(Uuid.random()),
        label = BookTypeLabel("Comic"),
        color = HexColor("FF00FF"),
    )

    private suspend fun ApplicationTestBuilder.loggedInClient(types: BookTypeService = mockk()): HttpClient {
        val auth = mockk<AuthService>()
        val client = handlerApp(auth, bookTypes = types)
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

    private suspend fun HttpClient.createType(body: String) = post("/api/book-types") { jsonBody(body) }

    private suspend fun HttpClient.patchType(id: BookTypeId, body: String) =
        patch("/api/book-types/$id") { jsonBody(body) }

    @Test
    fun `anonymous access to the type endpoints is rejected with json 401`() = testApplication {
        val client = handlerApp()
        val id = BookTypeId(BookTypes.KINDLE.id.value)

        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/book-types").status)
        assertEquals(HttpStatusCode.Unauthorized, client.patch("/api/book-types/$id").status)
        assertEquals(HttpStatusCode.Unauthorized, client.delete("/api/book-types/$id").status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/book-types.summaries").status)
    }

    @Test
    fun `summaries returns the types with their book counts`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.summaries() } returns listOf(BookTypeSummary(BookTypes.KINDLE, 3), BookTypeSummary(comic, 0))

        val response = client.get("/api/book-types.summaries")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(
            listOf(
                BookTypeSummaryResponse(BookTypes.KINDLE.id.toString(), "Kindle", "1A73B5", 3),
                BookTypeSummaryResponse(comic.id.toString(), "Comic", "FF00FF", 0),
            ),
            response.decodeBody<List<BookTypeSummaryResponse>>(),
        )
    }

    @Test
    fun `create returns 201 with a location header and trims the label and uppercases the colour`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.create(BookTypeLabel("Comic"), HexColor("FF00FF")) } returns comic

        val response = client.createType("""{"label":"  Comic ","associatedColor":"ff00ff"}""")

        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        assertEquals("/api/book-types/${comic.id}", response.headers["Location"])
        assertEquals(BookTypeResponse(comic.id.toString(), "Comic", "FF00FF"), response.decodeBody())
    }

    @Test
    fun `create with an invalid colour is a 400`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)

        client.createType("""{"label":"Comic","associatedColor":"#FF00FF"}""").assertValidationError("associatedColor")
        client.createType("""{"label":"Comic","associatedColor":"FF00F"}""").assertValidationError("associatedColor")
        client.createType("""{"label":"Comic","associatedColor":"GG00FF"}""").assertValidationError("associatedColor")
    }

    @Test
    fun `create with a blank or too long label is a 400`() = testApplication {
        val client = loggedInClient()

        client.createType("""{"label":"   ","associatedColor":"FF00FF"}""").assertValidationError("label")
        client.createType("""{"label":"${"x".repeat(65)}","associatedColor":"FF00FF"}""").assertValidationError("label")
    }

    @Test
    fun `create without a colour is a 400 invalid_body`() = testApplication {
        val client = loggedInClient()

        client.createType("""{"label":"Comic"}""").assertError(HttpStatusCode.BadRequest, "invalid_body")
    }

    @Test
    fun `create with a taken label is a 409 name_taken with the existing entry`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.create(BookTypeLabel("kindle"), HexColor("FF00FF")) } throws
            NameTakenException("book type", BookTypes.KINDLE.id.toString(), "Kindle")

        val error = client.createType("""{"label":"kindle","associatedColor":"FF00FF"}""")
            .assertError(HttpStatusCode.Conflict, "name_taken")

        assertEquals(BookTypes.KINDLE.id.toString(), error.existingId)
        assertEquals("Kindle", error.existingName)
    }

    @Test
    fun `patch with a label only passes a null colour`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.update(comic.id, BookTypeLabel("Comic"), null) } returns comic

        val response = client.patchType(comic.id, """{"label":"Comic"}""")

        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        assertEquals(BookTypeResponse(comic.id.toString(), "Comic", "FF00FF"), response.decodeBody())
    }

    @Test
    fun `patch with a colour only passes a null label and the uppercased colour`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.update(comic.id, null, HexColor("ABCDEF")) } returns comic

        assertEquals(HttpStatusCode.OK, client.patchType(comic.id, """{"associatedColor":"abcdef"}""").status)
        coVerify { types.update(comic.id, null, HexColor("ABCDEF")) }
    }

    @Test
    fun `patch with an empty body is a 400`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)

        client.patchType(comic.id, "{}").assertValidationError("label")
        client.patchType(comic.id, """{"label":null}""").assertValidationError("label")
    }

    @Test
    fun `patch with an invalid value is a 400`() = testApplication {
        val client = loggedInClient()

        client.patchType(comic.id, """{"associatedColor":"nope"}""").assertValidationError("associatedColor")
        client.patchType(comic.id, """{"label":" "}""").assertValidationError("label")
        client.patch("/api/book-types/not-a-uuid") { jsonBody("""{"label":"x"}""") }.assertValidationError("typeIds")
    }

    @Test
    fun `patch of an unknown type is 404`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.update(comic.id, BookTypeLabel("x"), null) } throws
            NotFoundException("book type", comic.id.toString())

        client.patchType(comic.id, """{"label":"x"}""").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `patch onto a taken label is a 409 name_taken with the existing entry`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.update(comic.id, BookTypeLabel("Kindle"), null) } throws
            NameTakenException("book type", BookTypes.KINDLE.id.toString(), "Kindle")

        val error = client.patchType(comic.id, """{"label":"Kindle"}""")
            .assertError(HttpStatusCode.Conflict, "name_taken")

        assertEquals(BookTypes.KINDLE.id.toString(), error.existingId)
        assertEquals("Kindle", error.existingName)
    }

    @Test
    fun `delete returns 204`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.delete(comic.id) } just Runs

        assertEquals(HttpStatusCode.NoContent, client.delete("/api/book-types/${comic.id}").status)
        coVerify { types.delete(comic.id) }
    }

    @Test
    fun `delete of an unknown type is 404`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.delete(comic.id) } throws NotFoundException("book type", comic.id.toString())

        client.delete("/api/book-types/${comic.id}").assertError(HttpStatusCode.NotFound, "not_found")
    }

    @Test
    fun `delete of a type still in use is a 409 conflict`() = testApplication {
        val types = mockk<BookTypeService>()
        val client = loggedInClient(types)
        coEvery { types.delete(comic.id) } throws ConflictException("book type", comic.id.toString())

        client.delete("/api/book-types/${comic.id}").assertError(HttpStatusCode.Conflict, "conflict")
    }
}
