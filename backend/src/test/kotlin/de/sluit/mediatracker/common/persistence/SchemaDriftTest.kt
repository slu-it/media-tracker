package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.allTables
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the contract between the Flyway scripts (source of truth) and the Exposed table objects:
 * after migrating an empty H2 database, Exposed must find nothing to change.
 */
class SchemaDriftTest {

    @Test
    fun `flyway migrations produce exactly the schema the Kotlin tables describe`() {
        DatabaseFactory.connect(freshH2Config("drift")).use { db ->
            val drift = DatabaseFactory.schemaDriftStatements(db.database, allTables)
            assertTrue(
                drift.isEmpty(),
                "Exposed tables and db/migration scripts differ. Statements Exposed would need:\n" +
                    drift.joinToString("\n"),
            )
        }
    }

    @Test
    fun `flyway history records every migration as successful`() {
        DatabaseFactory.connect(freshH2Config("drift")).use { db ->
            val rows = transaction(db.database) {
                val out = mutableListOf<Pair<String, Boolean>>()
                exec(
                    "SELECT version, success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank",
                ) { rs ->
                    while (rs.next()) out += rs.getString("version") to rs.getBoolean("success")
                }
                out
            }
            assertEquals(listOf("1" to true), rows.filter { it.first == "1" })
            assertTrue(rows.all { it.second }, "failed migrations in history: $rows")
            assertEquals(migrationFileCount(), rows.size, "history rows should match the number of V*.sql files")
        }
    }

    private fun migrationFileCount(): Int {
        val dir = checkNotNull(javaClass.getResource("/db/migration")) { "db/migration missing from classpath" }
        return java.io.File(dir.toURI()).listFiles { f -> f.name.matches(Regex("V\\d+__.*\\.sql")) }!!.size
    }
}
