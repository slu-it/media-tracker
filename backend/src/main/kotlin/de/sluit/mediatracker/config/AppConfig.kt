package de.sluit.mediatracker.config

import io.ktor.server.config.ApplicationConfig
import java.time.DateTimeException
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeParseException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Typed view of application.yaml. Fails fast at startup when a required value is missing. */
data class AppConfig(
    val port: Int,
    val database: DatabaseConfig,
    val session: SessionConfig,
    val coverSource: CoverSourceConfig,
    val dropbox: DropboxConfig?,
    val backup: BackupConfig,
) {
    companion object {
        fun from(config: ApplicationConfig): AppConfig = AppConfig(
            port = config.propertyOrNull("ktor.deployment.port")?.getString()?.toInt() ?: 8080,
            database = DatabaseConfig.from(config.config("database")),
            session = SessionConfig.from(config.config("session")),
            coverSource = CoverSourceConfig.from(config.config("coverSource")),
            dropbox = DropboxConfig.from(config.config("dropbox")),
            backup = BackupConfig.from(config.config("backup")),
        )
    }
}

/**
 * The daily Dropbox backup's schedule (MT-024, ADR 0028): `backup/api/BackupScheduler` runs
 * [de.sluit.mediatracker.backup.domain.CloudBackupService.backupNow] once a day at [dailyAt] in [zone]. Both come
 * from `BACKUP_DAILY_AT` / `BACKUP_ZONE`, defaulting to `03:00` / `Europe/Berlin` (the distroless container itself
 * runs in UTC, see `Dockerfile`). Bad input fails fast at startup with a clear message rather than a cryptic
 * `DateTimeParseException`/`DateTimeException` further down.
 */
data class BackupConfig(val dailyAt: LocalTime, val zone: ZoneId) {
    companion object {
        fun from(config: ApplicationConfig): BackupConfig {
            val dailyAt = config.propertyOrNull("dailyAt")?.getString() ?: "03:00"
            val zone = config.propertyOrNull("zone")?.getString() ?: "Europe/Berlin"
            return BackupConfig(
                dailyAt = try {
                    LocalTime.parse(dailyAt)
                } catch (e: DateTimeParseException) {
                    throw IllegalArgumentException("backup.dailyAt must be a HH:mm time, was '$dailyAt'", e)
                },
                zone = try {
                    ZoneId.of(zone)
                } catch (e: DateTimeException) {
                    throw IllegalArgumentException("backup.zone must be a valid time zone id, was '$zone'", e)
                },
            )
        }
    }
}

data class DatabaseConfig(
    val url: String,
    val user: String?,
    val password: String?,
    val maximumPoolSize: Int,
    val minimumIdle: Int,
    val keepaliveTime: Long,
    val maxLifetime: Long,
) {
    companion object {
        fun from(config: ApplicationConfig): DatabaseConfig = DatabaseConfig(
            url = config.property("url").getString(),
            user = config.propertyOrNull("user")?.getString()?.ifBlank { null },
            password = config.propertyOrNull("password")?.getString()?.ifBlank { null },
            maximumPoolSize = config.propertyOrNull("pool.maximumPoolSize")?.getString()?.toInt() ?: 3,
            minimumIdle = config.propertyOrNull("pool.minimumIdle")?.getString()?.toInt() ?: 1,
            keepaliveTime = config.propertyOrNull("pool.keepaliveTime")?.getString()?.toLong() ?: 300_000L,
            maxLifetime = config.propertyOrNull("pool.maxLifetime")?.getString()?.toLong() ?: 1_500_000L,
        )
    }
}

/** Optional outward cover image integrations (MT-017); `steamGridDb` is `null` when no key is configured. */
data class CoverSourceConfig(val steamGridDb: SteamGridDbConfig?) {
    companion object {
        fun from(config: ApplicationConfig): CoverSourceConfig {
            val steamGridDbConfig = config.config("steamGridDb")
            val apiKey = steamGridDbConfig.propertyOrNull("apiKey")?.getString()?.ifBlank { null }
            val steamGridDb = apiKey?.let {
                SteamGridDbConfig(
                    apiKey = it,
                    baseUrl = steamGridDbConfig.propertyOrNull("baseUrl")?.getString()
                        ?: "https://www.steamgriddb.com/api/v2",
                )
            }
            return CoverSourceConfig(steamGridDb)
        }
    }
}

/** SteamGridDB API access; only constructed when [apiKey] is non-blank, see [CoverSourceConfig.from]. */
data class SteamGridDbConfig(val apiKey: String, val baseUrl: String) {
    override fun toString(): String = "SteamGridDbConfig(apiKey=***, baseUrl=$baseUrl)"
}

/**
 * Dropbox OAuth app credentials (MT-024, ADR 0028); only constructed when both `DROPBOX_APP_KEY` and
 * `DROPBOX_APP_SECRET` are set (blank counts as unset, see [from]). `appKey` is not itself secret (the browser
 * sees it in the authorize URL); only `appSecret` is masked.
 */
data class DropboxConfig(
    val appKey: String,
    val appSecret: String,
    val apiBaseUrl: String = "https://api.dropboxapi.com",
    val contentBaseUrl: String = "https://content.dropboxapi.com",
) {
    override fun toString(): String =
        "DropboxConfig(appKey=$appKey, appSecret=***, apiBaseUrl=$apiBaseUrl, contentBaseUrl=$contentBaseUrl)"

    companion object {
        fun from(config: ApplicationConfig): DropboxConfig? {
            val appKey = config.propertyOrNull("appKey")?.getString()?.ifBlank { null }
            val appSecret = config.propertyOrNull("appSecret")?.getString()?.ifBlank { null }
            require((appKey == null) == (appSecret == null)) {
                "dropbox.appKey and dropbox.appSecret must both be set or both be blank"
            }
            if (appKey == null || appSecret == null) return null
            return DropboxConfig(
                appKey = appKey,
                appSecret = appSecret,
                apiBaseUrl = config.propertyOrNull("apiBaseUrl")?.getString() ?: "https://api.dropboxapi.com",
                contentBaseUrl = config.propertyOrNull("contentBaseUrl")?.getString()
                    ?: "https://content.dropboxapi.com",
            )
        }
    }
}

data class SessionConfig(
    val cookieName: String,
    val maxAge: Duration,
    val secureCookie: Boolean,
    /** HMAC key for signing the session id cookie. */
    val secret: String,
) {
    init {
        require(secret.length >= 16) { "session.secret must be at least 16 characters" }
    }

    companion object {
        fun from(config: ApplicationConfig): SessionConfig = SessionConfig(
            cookieName = config.propertyOrNull("cookieName")?.getString() ?: "MT_SESSION",
            maxAge = (config.propertyOrNull("maxAgeSeconds")?.getString()?.toLong() ?: 1_209_600L).seconds,
            secureCookie = config.propertyOrNull("secureCookie")?.getString()?.toBooleanStrict() ?: true,
            secret = config.property("secret").getString(),
        )
    }
}
