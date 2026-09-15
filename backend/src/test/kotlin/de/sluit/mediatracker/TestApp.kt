package de.sluit.mediatracker

import de.sluit.mediatracker.auth.PasswordHasher
import de.sluit.mediatracker.auth.UserRepository
import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.parameters
import io.ktor.server.config.ApplicationConfig
import io.ktor.server.testing.ApplicationTestBuilder
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.assertEquals

/*
 * Shared helpers for route tests. The H2 database in application-test.yaml is one named in-memory instance
 * per JVM (DB_CLOSE_DELAY=-1), so it survives between tests: seed idempotently or clean up in [seed].
 */

/** Boots the real module against H2, seeds one user and runs [seed] inside a transaction. */
fun ApplicationTestBuilder.appWithUser(username: String, password: String, seed: () -> Unit = {}): HttpClient {
    environment { config = ApplicationConfig("application-test.yaml") }
    application {
        module()
        transaction {
            val users = UserRepository()
            if (users.findByUsernameBlocking(username) == null) {
                users.createBlocking(username, PasswordHasher(memoryKb = 1024, iterations = 1).hash(password))
            }
            seed()
        }
    }
    return createClient {
        followRedirects = false
        install(HttpCookies)
    }
}

/** Posts the login form; the session cookie is kept by the client's cookie jar. */
suspend fun HttpClient.loginAs(username: String, password: String) {
    val login = submitForm(
        "/login",
        parameters {
            append("username", username)
            append("password", password)
        },
    )
    assertEquals(HttpStatusCode.Found, login.status, "login failed")
    assertEquals("/", login.headers["Location"], "login did not redirect to the app")
}

val testJson = Json { ignoreUnknownKeys = true }

suspend inline fun <reified T> HttpResponse.decodeBody(): T = testJson.decodeFromString(bodyAsText())

/** Sends [raw] as the JSON request body. Raw strings keep malformed-body tests possible. */
fun HttpRequestBuilder.jsonBody(raw: String) {
    contentType(ContentType.Application.Json)
    setBody(raw)
}
