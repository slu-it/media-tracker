package de.sluit.mediatracker.plugins

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals

class StatusPagesTest {

    private fun testApp(block: suspend io.ktor.client.HttpClient.() -> Unit) = testApplication {
        application {
            configureSerialization()
            configureStatusPages()
            routing {
                get("/api/boom") { error("boom") }
                get("/boom") { error("boom") }
                get("/mcp") { error("boom") }
                get("/mcp/") { error("boom") }
                get("/api/invalid") { throw InvalidValueException("title", "must not be blank") }
                get("/invalid") { throw InvalidValueException("title", "must not be blank") }
                get("/api/missing") { throw NotFoundException("game", "42") }
                get("/api/bad-body") { throw BadRequestException("x", IllegalArgumentException("first line\nsecond")) }
                get("/api/cover-unavailable") { throw ExternalSourceUnavailableException("cover_source") }
                get("/api/cover-error") {
                    throw ExternalSourceException("cover_source", "upstream said something secret")
                }
            }
        }
        client.block()
    }

    @Test
    fun `uncaught exception on an api path is a json 500 internal_error`() = testApp {
        val response = get("/api/boom")
        assertEquals(HttpStatusCode.InternalServerError, response.status)
        assertEquals(ContentType.Application.Json, response.contentType()?.withoutParameters())
        assertEquals("""{"error":"internal_error"}""", response.bodyAsText())
    }

    @Test
    fun `uncaught exception on mcp is a json 500 internal_error`() = testApp {
        val response = get("/mcp")
        assertEquals(HttpStatusCode.InternalServerError, response.status)
        assertEquals(ContentType.Application.Json, response.contentType()?.withoutParameters())
        assertEquals("""{"error":"internal_error"}""", response.bodyAsText())
    }

    @Test
    fun `uncaught exception on mcp with a trailing slash is a json 500 internal_error`() = testApp {
        val response = get("/mcp/")
        assertEquals(HttpStatusCode.InternalServerError, response.status)
        assertEquals(ContentType.Application.Json, response.contentType()?.withoutParameters())
        assertEquals("""{"error":"internal_error"}""", response.bodyAsText())
    }

    @Test
    fun `uncaught exception on a page path is a plain text 500`() = testApp {
        val response = get("/boom")
        assertEquals(HttpStatusCode.InternalServerError, response.status)
        assertEquals(ContentType.Text.Plain, response.contentType()?.withoutParameters())
        assertEquals("Internal server error", response.bodyAsText())
    }

    @Test
    fun `invalid value on an api path is a 400 validation_error with the message`() = testApp {
        val response = get("/api/invalid")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals(ContentType.Application.Json, response.contentType()?.withoutParameters())
        assertEquals("""{"error":"validation_error","message":"title: must not be blank"}""", response.bodyAsText())
    }

    @Test
    fun `invalid value on a page path is plain text with the message`() = testApp {
        val response = get("/invalid")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals(ContentType.Text.Plain, response.contentType()?.withoutParameters())
        assertEquals("title: must not be blank", response.bodyAsText())
    }

    @Test
    fun `not found exception on an api path is a json 404 without message`() = testApp {
        val response = get("/api/missing")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertEquals("""{"error":"not_found"}""", response.bodyAsText())
    }

    @Test
    fun `bad request exception reports only the first line of its cause`() = testApp {
        val response = get("/api/bad-body")
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("""{"error":"invalid_body","message":"first line"}""", response.bodyAsText())
    }

    @Test
    fun `external source unavailable exception is a json 503 named after the source`() = testApp {
        val response = get("/api/cover-unavailable")
        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        assertEquals(
            """{"error":"cover_source_unavailable","message":"cover_source is not configured"}""",
            response.bodyAsText(),
        )
    }

    @Test
    fun `external source exception is a json 502 named after the source without the upstream message`() = testApp {
        val response = get("/api/cover-error")
        assertEquals(HttpStatusCode.BadGateway, response.status)
        assertEquals(
            """{"error":"cover_source_error","message":"cover_source is currently unavailable"}""",
            response.bodyAsText(),
        )
    }

    @Test
    fun `unrouted api path is a json 404 via the status handler`() = testApp {
        val response = get("/api/does-not-exist")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertEquals("""{"error":"not_found"}""", response.bodyAsText())
    }

    @Test
    fun `unrouted page path is a plain text 404`() = testApp {
        val response = get("/does-not-exist")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertContains(response.bodyAsText(), "Not found")
    }
}
