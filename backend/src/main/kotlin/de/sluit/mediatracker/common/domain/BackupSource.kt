package de.sluit.mediatracker.common.domain

/**
 * One row of a backup table, keyed by its DB column name (not the JSON DTO field name). A value is a `String`,
 * `Long`, `Double`, `Boolean` or `null`; converting to/from JSON is the concern of `backup/api`, never of a
 * [BackupSource] or its callers.
 */
typealias BackupRow = Map<String, Any?>

/**
 * A domain's contribution to the JSON backup (MT-023, ADR 0027: step 1 of backups). Each business domain owns
 * the tables it wants backed up and contributes them through this interface, implemented generically for any
 * Exposed table by [de.sluit.mediatracker.common.persistence.ExposedBackupSource]; the `backup` package only
 * ever depends on this interface, never on a feature's persistence layer.
 */
interface BackupSource {
    /** The DB table names this source owns, in insert order (parents before the tables that reference them). */
    val tableNames: List<String>

    /** One entry per [tableNames], each a full dump of that table's rows. */
    suspend fun export(): Map<String, List<BackupRow>>

    /**
     * Checks [tables] (keyed by table name; a table name from [tableNames] missing from [tables] is treated as
     * empty) without writing anything, throwing [InvalidValueException] on the first problem found. Called on
     * every source before [BackupService.import][de.sluit.mediatracker.backup.domain.BackupService.import]
     * writes any of them, so one source's bad row cannot leave a partial write behind in another; framework-free
     * and DB-free by contract, so it never needs `suspend`.
     */
    fun validate(tables: Map<String, List<BackupRow>>)

    /**
     * Restores [tables] (keyed by table name; a table name from [tableNames] missing from [tables] is treated
     * as empty). Insert-if-absent by primary key, so importing the same dump twice inserts nothing the second
     * time. One result per key of [tables] this source recognised.
     */
    suspend fun import(tables: Map<String, List<BackupRow>>): Map<String, TableImportResult>
}

/** How many rows [BackupSource.import] inserted versus left alone because their primary key already existed. */
data class TableImportResult(val inserted: Int, val skipped: Int)
