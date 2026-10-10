package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.allTables
import de.sluit.mediatracker.books.SeededBookTypes
import de.sluit.mediatracker.books.persistence.BookTypesTable
import de.sluit.mediatracker.config.DatabaseConfig
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.persistence.GamePlatformsTable
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.statements.GlobalStatementInterceptor
import org.jetbrains.exposed.v1.core.statements.StatementContext
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.testcontainers.mariadb.MariaDBContainer

/*
 * Shared fixtures for backend tests: one MariaDB container (Testcontainers) for the whole test JVM, migrated
 * once and then truncated between tests instead of recreated (see withFreshDatabase); plus a helper to count
 * the SQL statements a block issues, used to catch N+1 query patterns. Docker is a hard requirement to run the
 * backend tests, see CLAUDE.md.
 */

private const val MARIADB_PORT = 3306
private const val DATABASE_NAME = "media_tracker_test"

/**
 * Seeded once by db/migration/V002__games.sql (game_platforms) and V012__books.sql (book_types), and editable
 * through the API since: [withFreshDatabase] does not truncate them with the rest but restores their canonical
 * rows through [resetSeededReferenceData].
 */
private val seedOnlyTableNames = setOf("game_platforms", "book_types")

/** Truncated by [resetSeededReferenceData]: the seeded tables and every item and link row that depends on them. */
private val resetTableNames = listOf(
    "game_to_platform",
    "game_to_developer",
    "game_expansions",
    "games",
    "game_platforms",
    "book_to_type",
    "book_to_author",
    "book_to_narrator",
    "book_to_series",
    "books",
    "book_types",
)

/** One canonical row of a seeded reference table. */
data class SeededRow(val id: String, val label: String, val color: String)

/**
 * One MariaDB container for the whole test JVM, started lazily on first use. Testcontainers' Ryuk reaper removes
 * it when the JVM exits.
 */
private val mariaDbContainer: MariaDBContainer by lazy {
    val container = MariaDBContainer("mariadb:11.8").withDatabaseName(DATABASE_NAME)
    try {
        container.start()
    } catch (e: Exception) {
        throw IllegalStateException(
            "backend tests need Docker: Testcontainers could not start mariadb:11.8. " +
                "Start the Docker daemon and retry.",
            e,
        )
    }
    container
}

/** Connection settings for [mariaDbContainer]; a small pool, since only tests use it. */
fun testDatabaseConfig(): DatabaseConfig {
    val container = mariaDbContainer
    return DatabaseConfig(
        url = "jdbc:mariadb://${container.host}:${container.getMappedPort(MARIADB_PORT)}/" +
            "$DATABASE_NAME?sslMode=disable&timezone=UTC&preserveInstants=true",
        user = container.username,
        password = container.password,
        maximumPoolSize = 2,
        minimumIdle = 1,
        keepaliveTime = 30_000,
        maxLifetime = 60_000,
    )
}

/**
 * Connects and migrates [mariaDbContainer] once per test JVM; every test shares it, so never close it.
 *
 * Pinned as Exposed's default database: `module()` (via `appWithUser`) connects its own additional pool per
 * smoke test and closes it again when that test's `testApplication` stops, which would otherwise shift Exposed's
 * implicit "current database" (the most recently connected one, see `TransactionManager.defaultDatabase`)
 * out from under any `withFreshDatabase` test that runs around the same time and relies on the implicit
 * default (e.g. through `dbQuery`), most visibly in the statement-counting tests. Because this pool stays the
 * pinned default, every implicit `transaction {}`/`dbQuery {}` inside a smoke test also runs on this shared pool
 * rather than on the pool `module()` itself opened from the merged test config.
 */
val sharedTestDatabase: ConnectedDatabase by lazy {
    DatabaseFactory.connect(testDatabaseConfig()).also { TransactionManager.defaultDatabase = it.database }
}

/**
 * Empties every table in [allTables] on [sharedTestDatabase] except [seedOnlyTableNames] (`SET
 * FOREIGN_KEY_CHECKS = 0`, one `TRUNCATE TABLE` per table, `SET FOREIGN_KEY_CHECKS = 1`), restores the seeded
 * reference tables ([resetSeededReferenceData]), then runs [block] against it. Fast: the schema is migrated once
 * per JVM, only the data resets between tests.
 */
fun withFreshDatabase(block: suspend (ConnectedDatabase) -> Unit) {
    val db = sharedTestDatabase
    transaction(db.database) {
        exec("SET FOREIGN_KEY_CHECKS = 0")
        try {
            allTables.filter { it.tableName !in seedOnlyTableNames }.forEach { table ->
                exec("TRUNCATE TABLE ${table.tableName}")
            }
        } finally {
            exec("SET FOREIGN_KEY_CHECKS = 1")
        }
    }
    resetSeededReferenceData()
    runBlocking { block(db) }
}

/**
 * Restores `game_platforms` and `book_types` to the four canonical rows each (ids, labels and colours of V002 and
 * V012). Book types and game platforms are editable, so a test or a smoke test that changed them calls this
 * (smoke tests in their setup, before `appWithUser`; [withFreshDatabase] does it itself). Games and books
 * (with their expansion and link tables) are emptied too: they would otherwise reference platforms and types that
 * no longer exist, and a game without a platform is not valid. Developers, authors, narrators and series stay.
 */
fun resetSeededReferenceData() {
    transaction(sharedTestDatabase.database) {
        exec("SET FOREIGN_KEY_CHECKS = 0")
        try {
            resetTableNames.forEach {
                exec("TRUNCATE TABLE $it")
            }
        } finally {
            exec("SET FOREIGN_KEY_CHECKS = 1")
        }
        GamePlatformsTable.batchInsert(SeededPlatforms.ROWS) {
            this[GamePlatformsTable.id] = it.id
            this[GamePlatformsTable.label] = it.label
            this[GamePlatformsTable.associatedColor] = it.color
        }
        BookTypesTable.batchInsert(SeededBookTypes.ROWS) {
            this[BookTypesTable.id] = it.id
            this[BookTypesTable.label] = it.label
            this[BookTypesTable.associatedColor] = it.color
        }
    }
}

/**
 * Counts the SQL statements of [type] issued against [database] while [block] runs, by registering a
 * transient [GlobalStatementInterceptor]. Used to prove a repository method issues a constant number of
 * queries (no N+1) rather than one per row. Scoped to [database] since [GlobalStatementInterceptor] fires
 * for every transaction in the JVM, not just the one under test.
 */
suspend fun countStatements(
    database: Database,
    type: StatementType = StatementType.SELECT,
    block: suspend () -> Unit,
): Int {
    var count = 0
    val interceptor = object : GlobalStatementInterceptor {
        override fun beforeExecution(transaction: Transaction, context: StatementContext) {
            if (transaction.db == database && context.statement.type == type) count++
        }
    }
    JdbcTransaction.globalInterceptors.add(interceptor)
    try {
        block()
    } finally {
        JdbcTransaction.globalInterceptors.remove(interceptor)
    }
    return count
}
