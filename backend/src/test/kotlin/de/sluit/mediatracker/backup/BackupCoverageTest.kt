package de.sluit.mediatracker.backup

import de.sluit.mediatracker.allTables
import de.sluit.mediatracker.backupSources
import de.sluit.mediatracker.common.persistence.ExposedBackupSource
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Guards the contract between the schema registry and the backup registry (MT-023, ADR 0027): every table in
 * [allTables] must either be covered by exactly one of the [backupSources] wired in `Application.module()`, or
 * be named on [systemTables]. A new domain table that forgets a backup source fails this test instead of
 * silently missing from every export.
 */
class BackupCoverageTest {
    /** Never exported: `users` (API keys live in it) and `sessions` are system tables, not domain data. */
    private val systemTables = setOf("users", "sessions")

    @Test
    fun `every backed-up table name is covered by exactly one source`() {
        val coveredNames = backupSources.flatMap { it.tableNames }
        assertTrue(
            coveredNames.size == coveredNames.toSet().size,
            "duplicate backup table name(s) across sources: $coveredNames",
        )
    }

    @Test
    fun `every table in allTables is either backed up or an explicit system table`() {
        val covered = backupSources.flatMap { it.tableNames }.toSet()
        val allTableNames = allTables.map { it.tableName }.toSet()

        val missing = allTableNames - covered - systemTables
        assertTrue(missing.isEmpty(), "table(s) in allTables without a backup source: $missing")

        val systemOverlap = covered intersect systemTables
        assertTrue(systemOverlap.isEmpty(), "system table(s) unexpectedly wired as a backup source: $systemOverlap")
    }

    @Test
    fun `every backed-up table name actually exists in allTables`() {
        val covered = backupSources.flatMap { it.tableNames }.toSet()
        val allTableNames = allTables.map { it.tableName }.toSet()

        val unknown = covered - allTableNames
        assertTrue(unknown.isEmpty(), "backup source(s) for table(s) missing from allTables: $unknown")
    }

    @Test
    fun `every column of every backed-up table has a column type the import coercion supports`() {
        val covered = backupSources.flatMap { it.tableNames }.toSet()

        val unsupported = allTables
            .filter { it.tableName in covered }
            .flatMap { table -> table.columns.filterNot { ExposedBackupSource.supports(it.columnType) } }
            .map { "${it.table.tableName}.${it.name}" }

        assertTrue(unsupported.isEmpty(), "column(s) with a backup-unsupported column type: $unsupported")
    }
}
