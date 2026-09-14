package de.sluit.mediatracker

import de.sluit.mediatracker.api.apiRoutes
import de.sluit.mediatracker.auth.AuthService
import de.sluit.mediatracker.auth.DbSessionStorage
import de.sluit.mediatracker.auth.PasswordHasher
import de.sluit.mediatracker.auth.SessionRepository
import de.sluit.mediatracker.auth.UserRepository
import de.sluit.mediatracker.auth.loginRoutes
import de.sluit.mediatracker.config.AppConfig
import de.sluit.mediatracker.db.DatabaseFactory
import de.sluit.mediatracker.plugins.configureMonitoring
import de.sluit.mediatracker.plugins.configureSecurity
import de.sluit.mediatracker.plugins.configureSerialization
import de.sluit.mediatracker.plugins.configureSessions
import de.sluit.mediatracker.plugins.configureStatusPages
import de.sluit.mediatracker.web.webRoutes
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.log
import io.ktor.server.routing.routing

/**
 * Application module referenced from application.yaml (`ktor.application.modules`).
 * The process entry point is `io.ktor.server.cio.EngineMain`, configured in backend/build.gradle.kts.
 *
 * Wiring order: config -> database -> services -> plugins -> routes.
 */
fun Application.module() {
    val config = AppConfig.from(environment.config)

    val database = DatabaseFactory.connect(config.database)
    monitor.subscribe(ApplicationStopped) { database.close() }

    val passwordHasher = PasswordHasher()
    val userRepository = UserRepository()
    val sessionRepository = SessionRepository()
    val authService = AuthService(userRepository, passwordHasher)

    configureSerialization()
    configureMonitoring()
    configureStatusPages()
    configureSessions(config.session, DbSessionStorage(sessionRepository, config.session.maxAge))
    configureSecurity()

    routing {
        loginRoutes(authService)
        apiRoutes()
        webRoutes()
    }

    log.info("Media Tracker module loaded (port ${config.port})")
}
