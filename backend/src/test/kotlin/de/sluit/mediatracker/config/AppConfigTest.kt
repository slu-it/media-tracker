package de.sluit.mediatracker.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.ApplicationConfigurationException
import io.ktor.server.config.MapApplicationConfig
import java.time.LocalTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class AppConfigTest {

    @Test
    fun `reads every value from the configuration`() {
        val config = MapApplicationConfig(
            "ktor.deployment.port" to "9090",
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "database.user" to "dbuser",
            "database.password" to "dbpass",
            "database.pool.maximumPoolSize" to "5",
            "database.pool.minimumIdle" to "2",
            "database.pool.keepaliveTime" to "111000",
            "database.pool.maxLifetime" to "222000",
            "session.cookieName" to "CUSTOM_SESSION",
            "session.maxAgeSeconds" to "60",
            "session.secureCookie" to "false",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertEquals(9090, appConfig.port)
        assertEquals("jdbc:mariadb://localhost:3306/test", appConfig.database.url)
        assertEquals("dbuser", appConfig.database.user)
        assertEquals("dbpass", appConfig.database.password)
        assertEquals(5, appConfig.database.maximumPoolSize)
        assertEquals(2, appConfig.database.minimumIdle)
        assertEquals(111_000L, appConfig.database.keepaliveTime)
        assertEquals(222_000L, appConfig.database.maxLifetime)
        assertEquals("CUSTOM_SESSION", appConfig.session.cookieName)
        assertEquals(60.seconds, appConfig.session.maxAge)
        assertEquals(false, appConfig.session.secureCookie)
        assertEquals("a-secret-at-least-16-chars", appConfig.session.secret)
    }

    @Test
    fun `applies defaults for optional values`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
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
        assertEquals("MT_SESSION", appConfig.session.cookieName)
        assertEquals(1_209_600.seconds, appConfig.session.maxAge)
        assertEquals(true, appConfig.session.secureCookie)
        assertEquals(LocalTime.of(3, 0), appConfig.backup.dailyAt)
        assertEquals(ZoneId.of("Europe/Berlin"), appConfig.backup.zone)
    }

    @Test
    fun `blank database user and password are read as null`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
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
            "database.url" to "jdbc:mariadb://localhost:3306/test",
        )

        val exception = assertFailsWith<ApplicationConfigurationException> {
            AppConfig.from(config)
        }
        assertContains(exception.message.orEmpty(), "session.secret")
    }

    @Test
    fun `rejects a session secret shorter than 16 characters`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "too-short",
        )

        assertFailsWith<IllegalArgumentException> {
            AppConfig.from(config)
        }
    }

    @Test
    fun `rejects a non boolean secure cookie flag`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "session.secureCookie" to "maybe",
        )

        assertFailsWith<IllegalArgumentException> {
            AppConfig.from(config)
        }
    }

    @Test
    fun `the test configuration file is valid`() {
        // database.url/user/password are dummy values here; TestApp.appWithUser overrides them with the
        // Testcontainers MariaDB coordinates before module() runs, see application-test.yaml's comment.
        val appConfig = AppConfig.from(ApplicationConfig("application-test.yaml"))

        assertTrue(appConfig.database.url.startsWith("jdbc:mariadb:"))
        assertEquals("overridden-by-testapp", appConfig.database.user)
        assertEquals("MT_SESSION", appConfig.session.cookieName)
        assertTrue(appConfig.session.secret.length >= 16)
        assertEquals(false, appConfig.session.secureCookie)
        // Pinned blank in application-test.yaml so a developer's exported STEAMGRIDDB_API_KEY cannot flip tests.
        assertNull(appConfig.coverSource.steamGridDb)
        // Pinned blank in application-test.yaml so a developer's exported DROPBOX_APP_KEY/SECRET cannot flip tests.
        assertNull(appConfig.dropbox)
        assertEquals(LocalTime.of(3, 0), appConfig.backup.dailyAt)
        assertEquals(ZoneId.of("Europe/Berlin"), appConfig.backup.zone)
    }

    @Test
    fun `reads the steam grid db api key and base url when configured`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "coverSource.steamGridDb.apiKey" to "sgdb-key",
            "coverSource.steamGridDb.baseUrl" to "https://example.org/api/v2",
        )

        val appConfig = AppConfig.from(config)

        assertEquals("sgdb-key", appConfig.coverSource.steamGridDb?.apiKey)
        assertEquals("https://example.org/api/v2", appConfig.coverSource.steamGridDb?.baseUrl)
    }

    @Test
    fun `a blank steam grid db api key is read as an unconfigured cover source`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "coverSource.steamGridDb.apiKey" to "",
        )

        val appConfig = AppConfig.from(config)

        assertNull(appConfig.coverSource.steamGridDb)
    }

    @Test
    fun `an absent steam grid db configuration is read as an unconfigured cover source`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertNull(appConfig.coverSource.steamGridDb)
    }

    @Test
    fun `the steam grid db config toString masks the api key`() {
        val config = SteamGridDbConfig(apiKey = "sgdb-secret", baseUrl = "https://example.org/api/v2")

        assertFalse(config.toString().contains("sgdb-secret"))
    }

    @Test
    fun `defaults the steam grid db base url when absent`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "coverSource.steamGridDb.apiKey" to "sgdb-key",
        )

        val appConfig = AppConfig.from(config)

        assertEquals("https://www.steamgriddb.com/api/v2", appConfig.coverSource.steamGridDb?.baseUrl)
    }

    // ---- dropbox ----

    @Test
    fun `an absent dropbox configuration is read as unconfigured`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertNull(appConfig.dropbox)
    }

    @Test
    fun `blank dropbox app key and secret are read as unconfigured`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "dropbox.appKey" to "",
            "dropbox.appSecret" to "",
        )

        val appConfig = AppConfig.from(config)

        assertNull(appConfig.dropbox)
    }

    @Test
    fun `reads the dropbox app key and secret when both are configured`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "dropbox.appKey" to "key-1",
            "dropbox.appSecret" to "secret-1",
        )

        val appConfig = AppConfig.from(config)

        assertEquals("key-1", appConfig.dropbox?.appKey)
        assertEquals("secret-1", appConfig.dropbox?.appSecret)
        assertEquals("https://api.dropboxapi.com", appConfig.dropbox?.apiBaseUrl)
        assertEquals("https://content.dropboxapi.com", appConfig.dropbox?.contentBaseUrl)
    }

    @Test
    fun `rejects a dropbox app key set without a secret`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "dropbox.appKey" to "key-1",
        )

        assertFailsWith<IllegalArgumentException> { AppConfig.from(config) }
    }

    @Test
    fun `rejects a dropbox app secret set without a key`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "dropbox.appSecret" to "secret-1",
        )

        assertFailsWith<IllegalArgumentException> { AppConfig.from(config) }
    }

    @Test
    fun `the dropbox config toString masks the app secret`() {
        val config = DropboxConfig(appKey = "key-1", appSecret = "dropbox-secret")

        assertFalse(config.toString().contains("dropbox-secret"))
        assertTrue(config.toString().contains("key-1"))
    }

    // ---- backup schedule ----

    @Test
    fun `defaults the backup schedule to 03 00 europe berlin when absent`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
        )

        val appConfig = AppConfig.from(config)

        assertEquals(LocalTime.of(3, 0), appConfig.backup.dailyAt)
        assertEquals(ZoneId.of("Europe/Berlin"), appConfig.backup.zone)
    }

    @Test
    fun `reads a custom backup daily time and zone`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "backup.dailyAt" to "23:45",
            "backup.zone" to "America/New_York",
        )

        val appConfig = AppConfig.from(config)

        assertEquals(LocalTime.of(23, 45), appConfig.backup.dailyAt)
        assertEquals(ZoneId.of("America/New_York"), appConfig.backup.zone)
    }

    @Test
    fun `rejects a backup daily time that is not HH mm`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "backup.dailyAt" to "not-a-time",
        )

        assertFailsWith<IllegalArgumentException> { AppConfig.from(config) }
    }

    @Test
    fun `rejects a backup zone that is not a valid time zone id`() {
        val config = MapApplicationConfig(
            "database.url" to "jdbc:mariadb://localhost:3306/test",
            "session.secret" to "a-secret-at-least-16-chars",
            "backup.zone" to "Not/A_Zone",
        )

        assertFailsWith<IllegalArgumentException> { AppConfig.from(config) }
    }
}
