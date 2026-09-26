package de.sluit.mediatracker

import de.sluit.mediatracker.auth.api.DbSessionStorage
import de.sluit.mediatracker.auth.api.configureSecurity
import de.sluit.mediatracker.auth.api.configureSessions
import de.sluit.mediatracker.auth.api.loginRoutes
import de.sluit.mediatracker.auth.domain.ApiKeyService
import de.sluit.mediatracker.auth.domain.AuthService
import de.sluit.mediatracker.auth.domain.PasswordHasher
import de.sluit.mediatracker.auth.persistence.ExposedSessionRepository
import de.sluit.mediatracker.auth.persistence.ExposedUserRepository
import de.sluit.mediatracker.backup.api.BackupScheduler
import de.sluit.mediatracker.backup.api.JsonBackupCodec
import de.sluit.mediatracker.backup.domain.BackupService
import de.sluit.mediatracker.backup.domain.CloudBackupService
import de.sluit.mediatracker.common.persistence.DatabaseFactory
import de.sluit.mediatracker.config.AppConfig
import de.sluit.mediatracker.config.SessionConfig
import de.sluit.mediatracker.dropbox.domain.DropboxService
import de.sluit.mediatracker.dropbox.integration.DropboxHttpApi
import de.sluit.mediatracker.dropbox.integration.dropboxHttpClient
import de.sluit.mediatracker.dropbox.persistence.ExposedDropboxConnectionRepository
import de.sluit.mediatracker.games.domain.CoverOptionsService
import de.sluit.mediatracker.games.domain.ExpansionService
import de.sluit.mediatracker.games.domain.GameService
import de.sluit.mediatracker.games.integration.SteamGridDbCoverSource
import de.sluit.mediatracker.games.integration.steamGridDbHttpClient
import de.sluit.mediatracker.games.persistence.ExposedExpansionRepository
import de.sluit.mediatracker.games.persistence.ExposedGamePlatformRepository
import de.sluit.mediatracker.games.persistence.ExposedGameRepository
import de.sluit.mediatracker.plugins.configureMonitoring
import de.sluit.mediatracker.plugins.configureSerialization
import de.sluit.mediatracker.plugins.configureStatusPages
import io.ktor.server.application.Application
import io.ktor.server.application.log
import io.ktor.server.routing.routing
import io.ktor.server.sessions.SessionStorage
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlin.time.Clock
import java.time.Clock as JavaClock

/**
 * The services the HTTP layer needs; built from Exposed repositories in [module], from MockK mocks in handler tests.
 */
class Services(
    val auth: AuthService,
    val games: GameService,
    val apiKeys: ApiKeyService,
    val expansions: ExpansionService,
    val coverOptions: CoverOptionsService,
    val backup: BackupService,
    val dropbox: DropboxService,
    val cloudBackup: CloudBackupService,
)

/**
 * Plugins and routes, independent of how the services and the session storage are backed.
 * Handler tests call this with MockK services and Ktor's SessionStorageMemory; [module] calls it with the real ones.
 */
fun Application.configureHttp(services: Services, sessionConfig: SessionConfig, sessionStorage: SessionStorage) {
    configureSerialization()
    configureMonitoring()
    configureStatusPages()
    configureSessions(sessionConfig, sessionStorage)
    configureSecurity(services.apiKeys)

    routing {
        loginRoutes(services.auth)
        apiRoutes(services)
        mcpRoutes(services)
        webRoutes()
    }
}

/**
 * Application module referenced from application.yaml (`ktor.application.modules`).
 * The process entry point is `io.ktor.server.cio.EngineMain`, configured in backend/build.gradle.kts.
 *
 * Wiring order: config -> database -> services -> configureHttp (plugins -> routes).
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
    DatabaseFactory.warnOnSchemaDrift(database.database, allTables)

    val passwordHasher = PasswordHasher()
    val userRepository = ExposedUserRepository()
    val sessionRepository = ExposedSessionRepository()
    val authService = AuthService(userRepository, passwordHasher)
    val gameRepository = ExposedGameRepository()
    val gameService = GameService(gameRepository, ExposedGamePlatformRepository())
    val apiKeyService = ApiKeyService(userRepository)
    val expansionService = ExpansionService(gameRepository, ExposedExpansionRepository())

    val coverSource = config.coverSource.steamGridDb?.let { steamGridDbConfig ->
        val client = steamGridDbHttpClient()
        coroutineContext.job.invokeOnCompletion { client.close() }
        SteamGridDbCoverSource(client, steamGridDbConfig)
    }
    if (coverSource != null) {
        log.info("cover source: steamgriddb configured")
    } else {
        log.info("cover source: not configured (STEAMGRIDDB_API_KEY unset)")
    }
    val coverOptionsService = CoverOptionsService(coverSource)
    val backupService = BackupService(backupSources)

    val dropboxBackend = config.dropbox?.let { dropboxConfig ->
        val client = dropboxHttpClient()
        coroutineContext.job.invokeOnCompletion { client.close() }
        DropboxService.Backend(DropboxHttpApi(client, dropboxConfig), dropboxConfig.appKey)
    }
    if (dropboxBackend != null) {
        log.info("dropbox: configured")
    } else {
        log.info("dropbox: not configured (DROPBOX_APP_KEY/DROPBOX_APP_SECRET unset)")
    }
    val dropboxService = DropboxService(dropboxBackend, ExposedDropboxConnectionRepository(), Clock.System)
    val cloudBackupService = CloudBackupService(backupService, JsonBackupCodec(), dropboxService)

    log.info("dropbox backup scheduled daily at ${config.backup.dailyAt} ${config.backup.zone}")
    launch { BackupScheduler(cloudBackupService, config.backup, JavaClock.system(config.backup.zone)).run() }

    val services = Services(
        authService,
        gameService,
        apiKeyService,
        expansionService,
        coverOptionsService,
        backupService,
        dropboxService,
        cloudBackupService,
    )

    configureHttp(services, config.session, DbSessionStorage(sessionRepository, config.session.maxAge))

    log.info("Media Tracker module loaded (port ${config.port})")
}
