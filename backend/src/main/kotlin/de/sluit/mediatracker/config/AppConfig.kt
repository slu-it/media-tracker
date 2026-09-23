package de.sluit.mediatracker.config

import io.ktor.server.config.ApplicationConfig
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Typed view of application.yaml. Fails fast at startup when a required value is missing. */
data class AppConfig(
    val port: Int,
    val database: DatabaseConfig,
    val session: SessionConfig,
    val coverSource: CoverSourceConfig,
) {
    companion object {
        fun from(config: ApplicationConfig): AppConfig = AppConfig(
            port = config.propertyOrNull("ktor.deployment.port")?.getString()?.toInt() ?: 8080,
            database = DatabaseConfig.from(config.config("database")),
            session = SessionConfig.from(config.config("session")),
            coverSource = CoverSourceConfig.from(config.config("coverSource")),
        )
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
