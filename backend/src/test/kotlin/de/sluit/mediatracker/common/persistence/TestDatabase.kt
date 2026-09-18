package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.config.DatabaseConfig
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.statements.GlobalStatementInterceptor
import org.jetbrains.exposed.v1.core.statements.StatementContext
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import java.util.UUID

/*
 * Shared fixtures for repository tests: a disposable, migrated H2 database per test (see
 * de.sluit.mediatracker.common.persistence.ConnectedDatabase) and a helper to count the SQL statements a
 * block issues, used to catch N+1 query patterns.
 */

/** A fresh named in-memory H2 database in MySQL mode; never reused across calls. */
fun freshH2Config(prefix: String = "test"): DatabaseConfig = DatabaseConfig(
    url = "jdbc:h2:mem:${prefix}_${UUID.randomUUID().toString().replace("-", "")};" +
        "MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
    user = "sa",
    password = null,
    maximumPoolSize = 2,
    minimumIdle = 1,
    keepaliveTime = 30_000,
    maxLifetime = 60_000,
    timestampType = "TIMESTAMP(9)",
)

/** Connects and migrates a fresh H2 database; callers must [ConnectedDatabase.close] it. */
fun freshH2(): ConnectedDatabase = DatabaseFactory.connect(freshH2Config())

/** Runs [block] against a fresh, migrated H2 database that is closed afterwards. */
fun withFreshDatabase(block: suspend (ConnectedDatabase) -> Unit) {
    freshH2().use { db -> runBlocking { block(db) } }
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
