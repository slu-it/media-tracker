package de.sluit.mediatracker.config

import io.ktor.server.config.ApplicationConfig
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Typed view of application.yaml. Fails fast at startup when a required value is missing. */
data class AppConfig(val port: Int, val database: DatabaseConfig, val session: SessionConfig) {
    companion object {
        fun from(config: ApplicationConfig): AppConfig = AppConfig(
            port = config.propertyOrNull("ktor.deployment.port")?.getString()?.toInt() ?: 8080,
            database = DatabaseConfig.from(config.config("database")),
            session = SessionConfig.from(config.config("session")),
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
    /** Replaces `${timestamp_type}` in the Flyway scripts; engine-specific, see application.yaml. */
    val timestampType: String = DEFAULT_TIMESTAMP_TYPE,
) {
    companion object {
        const val DEFAULT_TIMESTAMP_TYPE = "DATETIME(6)"

        fun from(config: ApplicationConfig): DatabaseConfig = DatabaseConfig(
            url = config.property("url").getString(),
            user = config.propertyOrNull("user")?.getString()?.ifBlank { null },
            password = config.propertyOrNull("password")?.getString()?.ifBlank { null },
            maximumPoolSize = config.propertyOrNull("pool.maximumPoolSize")?.getString()?.toInt() ?: 3,
            minimumIdle = config.propertyOrNull("pool.minimumIdle")?.getString()?.toInt() ?: 1,
            keepaliveTime = config.propertyOrNull("pool.keepaliveTime")?.getString()?.toLong() ?: 300_000L,
            maxLifetime = config.propertyOrNull("pool.maxLifetime")?.getString()?.toLong() ?: 1_500_000L,
            timestampType = config.propertyOrNull("migration.timestampType")?.getString() ?: DEFAULT_TIMESTAMP_TYPE,
        )
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
