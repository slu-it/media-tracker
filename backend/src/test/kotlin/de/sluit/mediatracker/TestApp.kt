package de.sluit.mediatracker

import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.PasswordHasher
import de.sluit.mediatracker.auth.domain.User
import de.sluit.mediatracker.auth.persistence.ExposedUserRepository
import de.sluit.mediatracker.backup.domain.BackupService
import de.sluit.mediatracker.common.persistence.sharedTestDatabase
import de.sluit.mediatracker.common.persistence.testDatabaseConfig
import de.sluit.mediatracker.config.SessionConfig
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.ExpansionService
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
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.mergeWith
import io.ktor.server.sessions.SessionStorageMemory
import io.ktor.server.testing.ApplicationTestBuilder
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.hours

/*
 * Shared helpers for route tests, of two kinds:
 *  - [appWithUser] boots the real `module()` against the Testcontainers MariaDB shared by the whole test JVM,
 *    for smoke tests that need the whole stack.
 *  - [handlerApp] boots only `configureHttp`, with MockK services and an in-memory session store, for
 *    handler tests that exercise plugins and routes without a database.
 * The shared database survives between tests: seed idempotently or clean up in [seed].
 */

/**
 * Boots the real module against the Testcontainers MariaDB shared by the whole test JVM, seeds one user and
 * runs [seed] inside a transaction. `application-test.yaml`'s `database.url/user/password` are dummy values;
 * they are overridden here with the container's coordinates so every test class talks to the same database.
 */
fun ApplicationTestBuilder.appWithUser(username: String, password: String, seed: () -> Unit = {}): HttpClient {
    val cfg = testDatabaseConfig()
    // Touches the shared, lazily-created database first, so Flyway has already migrated by the time module()
    // runs its own (then no-op) connect + migrate.
    sharedTestDatabase
    environment {
        config = ApplicationConfig("application-test.yaml").mergeWith(
            MapApplicationConfig(
                "database.url" to cfg.url,
                "database.user" to checkNotNull(cfg.user),
                "database.password" to checkNotNull(cfg.password),
            ),
        )
    }
    application {
        module()
        transaction {
            val users = ExposedUserRepository()
            val hash = PasswordHasher(memoryKb = 1024, iterations = 1).hash(password)
            val existing = users.findByUsernameBlocking(username)
            // Upsert, not create-if-absent: `username` is a fixture name (`alice`) other test classes also
            // insert directly into the shared users table with an unrelated, non-matching password hash (e.g.
            // ExposedSessionRepositoryTest); this must always leave `username`/`password` valid for login.
            if (existing == null) {
                users.createBlocking(username, hash)
            } else {
                users.updatePasswordBlocking(existing.id, hash)
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
    expansions: ExpansionService = mockk(),
    // Every /mcp request re-registers the game tools, which checks isAvailable; default it to false (no
    // find_game_cover tool) so tests that never touch cover images do not have to stub it themselves.
    coverOptions: CoverOptionsService = mockk<CoverOptionsService> { every { isAvailable } returns false },
    backup: BackupService = mockk(),
): HttpClient {
    application {
        configureHttp(
            Services(auth, games, apiKeys, expansions, coverOptions, backup),
            testSessionConfig,
            SessionStorageMemory(),
        )
    }
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
