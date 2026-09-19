package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.allTables
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the contract between the Flyway scripts (source of truth) and the Exposed table objects: on the
 * shared, migrated Testcontainers MariaDB, Exposed must find nothing to change.
 */
class SchemaDriftTest {

    @Test
    fun `flyway migrations produce exactly the schema the Kotlin tables describe`() {
        val db = sharedTestDatabase
        val drift = DatabaseFactory.schemaDriftStatements(db.database, allTables)
        assertTrue(
            drift.isEmpty(),
            "Exposed tables and db/migration scripts differ. Statements Exposed would need:\n" +
                drift.joinToString("\n"),
        )
    }

    @Test
    fun `flyway applies the mariadb fulltext indexes`() {
        val db = sharedTestDatabase
        val indexNames = transaction(db.database) {
            exec(
                """
                SELECT INDEX_NAME FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'games' AND INDEX_TYPE = 'FULLTEXT'
                """.trimIndent(),
            ) { resultSet ->
                buildSet {
                    while (resultSet.next()) add(resultSet.getString("INDEX_NAME"))
                }
            }
        }

        assertEquals(setOf("ft_games_title", "ft_games_description"), indexNames)
    }

    @Test
    fun `flyway history records every migration as successful`() {
        val db = sharedTestDatabase
        val rows = transaction(db.database) {
            val out = mutableListOf<Pair<String, Boolean>>()
            exec(
                "SELECT version, success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank",
            ) { rs ->
                while (rs.next()) out += rs.getString("version") to rs.getBoolean("success")
            }
            out
        }
        assertEquals(listOf("001" to true), rows.filter { it.first == "001" })
        assertTrue(rows.all { it.second }, "failed migrations in history: $rows")
        assertEquals(migrationFileCount(), rows.size, "history rows should match the number of V*.sql files")
    }

    private fun migrationFileCount(): Int {
        val path = DatabaseFactory.MIGRATIONS_LOCATION.removePrefix("classpath:")
        val dir = checkNotNull(javaClass.getResource("/$path")) { "$path missing from classpath" }
        return java.io.File(dir.toURI()).listFiles { f -> f.name.matches(Regex("V\\d+__.*\\.sql")) }!!.size
    }
}
