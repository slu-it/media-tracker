package de.sluit.mediatracker.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import de.sluit.mediatracker.config.DatabaseConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.migration.jdbc.MigrationUtils
import org.slf4j.LoggerFactory

/** Connected database plus the pool that owns its connections. */
class ConnectedDatabase(val database: Database, private val dataSource: HikariDataSource) : AutoCloseable {
    override fun close() = dataSource.close()
}

object DatabaseFactory {
    private val log = LoggerFactory.getLogger(DatabaseFactory::class.java)

    const val MIGRATIONS_LOCATION = "classpath:db/migration"
    const val TIMESTAMP_TYPE_PLACEHOLDER = "timestamp_type"

    /**
     * Opens the HikariCP pool, applies pending Flyway migrations, binds Exposed to the pool and finally
     * checks that the Kotlin table objects match the migrated schema (a warning, never fatal).
     *
     * The SQL under `db/migration` is the source of truth for the schema; see docs/decisions/0004.
     */
    fun connect(config: DatabaseConfig): ConnectedDatabase {
        val hikari = HikariConfig().apply {
            jdbcUrl = config.url
            config.user?.let { username = it }
            config.password?.let { password = it }
            maximumPoolSize = config.maximumPoolSize
            minimumIdle = config.minimumIdle
            keepaliveTime = config.keepaliveTime
            maxLifetime = config.maxLifetime
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_REPEATABLE_READ"
            poolName = "media-tracker"
            validate()
        }
        val dataSource = HikariDataSource(hikari)
        try {
            migrate(dataSource, config)
        } catch (e: RuntimeException) {
            dataSource.close()
            throw e
        }

        val database = Database.connect(dataSource)
        warnOnSchemaDrift(database)
        log.info("Database ready ({})", config.url.substringBefore('?'))
        return ConnectedDatabase(database, dataSource)
    }

    /** Runs outside any Exposed transaction: Flyway takes and commits its own connections. */
    private fun migrate(dataSource: HikariDataSource, config: DatabaseConfig) {
        val flyway = Flyway.configure()
            .dataSource(dataSource)
            .locations(MIGRATIONS_LOCATION)
            .validateMigrationNaming(true)
            .placeholders(mapOf(TIMESTAMP_TYPE_PLACEHOLDER to config.timestampType))
            .load()
        val result = flyway.migrate()
        if (result.migrationsExecuted > 0) {
            log.info(
                "Applied {} schema migration(s): {} -> schema version {}",
                result.migrationsExecuted,
                result.migrations.joinToString { "${it.version} ${it.description}" },
                result.targetSchemaVersion,
            )
        } else {
            log.info("Schema is up to date (version {})", result.targetSchemaVersion ?: result.initialSchemaVersion)
        }
    }

    /**
     * Compares the Exposed table objects with the live schema. A non-empty result means the Kotlin model and the
     * Flyway scripts have drifted apart; SchemaDriftTest catches this before deployment, this log line catches
     * it on the Pi. Never applies anything.
     */
    private fun warnOnSchemaDrift(database: Database) {
        val statements = schemaDriftStatements(database)
        if (statements.isNotEmpty()) {
            log.warn(
                "Kotlin table definitions differ from the database schema. Statements Exposed would need:\n{}",
                statements.joinToString("\n"),
            )
        }
    }

    /** The statements Exposed would need to make the live schema match [allTables]; empty when in sync. */
    fun schemaDriftStatements(database: Database): List<String> = transaction(database) {
        MigrationUtils.statementsRequiredForDatabaseMigration(*allTables, withLogs = false)
    }
}

/**
 * Runs a blocking Exposed transaction off the request coroutine.
 * Exposed 1.x JDBC is synchronous; Dispatchers.IO keeps CIO's event loop free.
 */
suspend fun <T> dbQuery(block: () -> T): T = withContext(Dispatchers.IO) {
    transaction { block() }
}
