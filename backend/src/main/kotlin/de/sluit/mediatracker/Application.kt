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
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.games.persistence.ExposedGamePlatformRepository
import de.sluit.mediatracker.games.persistence.ExposedGameRepository
import de.sluit.mediatracker.plugins.configureMonitoring
import de.sluit.mediatracker.plugins.configureSecurity
import de.sluit.mediatracker.plugins.configureSerialization
import de.sluit.mediatracker.plugins.configureSessions
import de.sluit.mediatracker.plugins.configureStatusPages
import de.sluit.mediatracker.web.webRoutes
import io.ktor.server.application.Application
import io.ktor.server.application.log
import io.ktor.server.routing.routing
import kotlinx.coroutines.job

/**
 * Application module referenced from application.yaml (`ktor.application.modules`).
 * The process entry point is `io.ktor.server.cio.EngineMain`, configured in backend/build.gradle.kts.
 *
 * Wiring order: config -> database -> services -> plugins -> routes.
 *
 * Shutdown hooks hang off this instance's coroutine job, not the shared `monitor`: with Ktor auto-reload
 * (`./gradlew :backend:run -Pmt.dev=true`) the new module instance is started before the old one is stopped,
 * and a `monitor.subscribe(ApplicationStopped)` handler registered by the new instance would fire for the
 * old instance's stop and close the new pool.
 */
fun Application.module() {
    val config = AppConfig.from(environment.config)

    val database = DatabaseFactory.connect(config.database)
    coroutineContext.job.invokeOnCompletion { database.close() }

    val passwordHasher = PasswordHasher()
    val userRepository = UserRepository()
    val sessionRepository = SessionRepository()
    val authService = AuthService(userRepository, passwordHasher)
    val gameService = GameService(ExposedGameRepository(), ExposedGamePlatformRepository())

    configureSerialization()
    configureMonitoring()
    configureStatusPages()
    configureSessions(config.session, DbSessionStorage(sessionRepository, config.session.maxAge))
    configureSecurity()

    routing {
        loginRoutes(authService)
        apiRoutes(gameService)
        webRoutes()
    }

    log.info("Media Tracker module loaded (port ${config.port})")
}
