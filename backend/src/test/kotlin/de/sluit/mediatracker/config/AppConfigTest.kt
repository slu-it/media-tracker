package de.sluit.mediatracker.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.ApplicationConfigurationException
import io.ktor.server.config.MapApplicationConfig
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class AppConfigTest {

    @Test
    fun `reads every value from the configuration`() {
        val config = MapApplicationConfig(
            "ktor.deployment.port" to "9090",
            "database.url" to "jdbc:h2:mem:test",
            "database.user" to "dbuser",
            "database.password" to "dbpass",
            "database.pool.maximumPoolSize" to "5",
            "database.pool.minimumIdle" to "2",
            "database.pool.keepaliveTime" to "111000",
            "database.pool.maxLifetime" to "222000",
            "database.migration.timestampType" to "TIMESTAMP(9)",
            "session.cookieName" to "CUSTOM_SESSION",
            "session.maxAgeSeconds" to "60",
            "session.secureCookie" to "false",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertEquals(9090, appConfig.port)
        assertEquals("jdbc:h2:mem:test", appConfig.database.url)
        assertEquals("dbuser", appConfig.database.user)
        assertEquals("dbpass", appConfig.database.password)
        assertEquals(5, appConfig.database.maximumPoolSize)
        assertEquals(2, appConfig.database.minimumIdle)
        assertEquals(111_000L, appConfig.database.keepaliveTime)
        assertEquals(222_000L, appConfig.database.maxLifetime)
        assertEquals("TIMESTAMP(9)", appConfig.database.timestampType)
        assertEquals("CUSTOM_SESSION", appConfig.session.cookieName)
        assertEquals(60.seconds, appConfig.session.maxAge)
        assertEquals(false, appConfig.session.secureCookie)
        assertEquals("a-secret-at-least-16-chars", appConfig.session.secret)
    }

    @Test
    fun `applies defaults for optional values`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:h2:mem:test",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertEquals(8080, appConfig.port)
        assertNull(appConfig.database.user)
        assertNull(appConfig.database.password)
        assertEquals(3, appConfig.database.maximumPoolSize)
        assertEquals(1, appConfig.database.minimumIdle)
        assertEquals(300_000L, appConfig.database.keepaliveTime)
        assertEquals(1_500_000L, appConfig.database.maxLifetime)
        assertEquals(DatabaseConfig.DEFAULT_TIMESTAMP_TYPE, appConfig.database.timestampType)
        assertEquals("MT_SESSION", appConfig.session.cookieName)
        assertEquals(1_209_600.seconds, appConfig.session.maxAge)
        assertEquals(true, appConfig.session.secureCookie)
    }

    @Test
    fun `blank database user and password are read as null`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:h2:mem:test",
            "database.user" to "",
            "database.password" to "",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertNull(appConfig.database.user)
        assertNull(appConfig.database.password)
    }

    @Test
    fun `fails fast when database url is missing`() {
        val config = MapApplicationConfig(
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val exception = assertFailsWith<ApplicationConfigurationException> {
            AppConfig.from(config)
        }
        assertContains(exception.message.orEmpty(), "database.url")
    }

    @Test
    fun `fails fast when session secret is missing`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:h2:mem:test",
        )

        val exception = assertFailsWith<ApplicationConfigurationException> {
            AppConfig.from(config)
        }
        assertContains(exception.message.orEmpty(), "session.secret")
    }

    @Test
    fun `rejects a session secret shorter than 16 characters`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:h2:mem:test",
            "session.secret" to "too-short",
        )

        assertFailsWith<IllegalArgumentException> {
            AppConfig.from(config)
        }
    }

    @Test
    fun `rejects a non boolean secure cookie flag`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:h2:mem:test",
            "session.secret" to "a-secret-at-least-16-chars",
            "session.secureCookie" to "maybe",
        )

        assertFailsWith<IllegalArgumentException> {
            AppConfig.from(config)
        }
    }

    @Test
    fun `the test configuration file is valid`() {
        val appConfig = AppConfig.from(ApplicationConfig("application-test.yaml"))

        assertTrue(appConfig.database.url.startsWith("jdbc:h2:mem:"))
        assertEquals("sa", appConfig.database.user)
        assertEquals("TIMESTAMP(9)", appConfig.database.timestampType)
        assertEquals("MT_SESSION", appConfig.session.cookieName)
        assertTrue(appConfig.session.secret.length >= 16)
        assertEquals(false, appConfig.session.secureCookie)
    }
}
