package de.sluit.mediatracker

import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.PasswordHasher
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.auth.persistence.ExposedUserRepository
import de.sluit.mediatracker.config.SessionConfig
import de.sluit.mediatracker.games.domain.GameService
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
import io.ktor.server.sessions.SessionStorageMemory
import io.ktor.server.testing.ApplicationTestBuilder
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.hours

/*
 * Shared helpers for route tests, of two kinds:
 *  - [appWithUser] boots the real `module()` against H2, for smoke tests that need the whole stack.
 *  - [handlerApp] boots only `configureHttp`, with MockK services and an in-memory session store, for
 *    handler tests that exercise plugins and routes without a database.
 * The H2 database in application-test.yaml is one named in-memory instance per JVM (DB_CLOSE_DELAY=-1),
 * so it survives between tests: seed idempotently or clean up in [seed].
 */

/** Boots the real module against H2, seeds one user and runs [seed] inside a transaction. */
fun ApplicationTestBuilder.appWithUser(username: String, password: String, seed: () -> Unit = {}): HttpClient {
    environment { config = ApplicationConfig("application-test.yaml") }
    application {
        module()
        transaction {
            val users = ExposedUserRepository()
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

/** Session settings for handler tests; mirrors application-test.yaml without reading it (no database is involved). */
val testSessionConfig = SessionConfig(
    cookieName = "MT_SESSION",
    maxAge = 1.hours,
    secureCookie = false,
    secret = "test-secret-test-secret-test-secret",
)

/**
 * Boots plugins and routes only ([configureHttp]): the services are the given MockK mocks (strict by default),
 * sessions live in [SessionStorageMemory], no database is opened. Use for handler tests.
 */
fun ApplicationTestBuilder.handlerApp(
    auth: AuthService = mockk(),
    games: GameService = mockk(),
    apiKeys: ApiKeyService = mockk(),
): HttpClient {
    application { configureHttp(Services(auth, games, apiKeys), testSessionConfig, SessionStorageMemory()) }
    return createClient {
        followRedirects = false
        install(HttpCookies)
    }
}

/** Posts the login form; the session cookie is kept by the client's cookie jar. */
suspend fun HttpClient.loginAs(username: String, password: String): HttpResponse {
    val login = submitForm(
        "/login",
        parameters {
            append("username", username)
            append("password", password)
        },
    )
    assertEquals(HttpStatusCode.Found, login.status, "login failed")
    assertEquals("/", login.headers["Location"], "login did not redirect to the app")
    return login
}

/**
 * Stubs [auth] to accept [username] with any password, then logs in through the real /login so the client holds a
 * signed session cookie.
 */
suspend fun HttpClient.loginAsMocked(auth: AuthService, username: String = "alice", userId: Long = 1L): HttpResponse {
    coEvery { auth.login(username, any()) } returns User(id = userId, username = username, passwordHash = "irrelevant")
    return loginAs(username, "irrelevant")
}

val testJson = Json { ignoreUnknownKeys = true }

suspend inline fun <reified T> HttpResponse.decodeBody(): T = testJson.decodeFromString(bodyAsText())

/** Sends [raw] as the JSON request body. Raw strings keep malformed-body tests possible. */
fun HttpRequestBuilder.jsonBody(raw: String) {
    contentType(ContentType.Application.Json)
    setBody(raw)
}
