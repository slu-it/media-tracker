package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.BackupSource
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.TableImportResult
import org.jetbrains.exposed.v1.core.BooleanColumnType
import org.jetbrains.exposed.v1.core.CharColumnType
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.DoubleColumnType
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.slf4j.LoggerFactory

/**
 * Generic [BackupSource] over any list of Exposed [Table]s (MT-023, ADR 0027). A feature only needs
 * `object <Kind>BackupSource : ExposedBackupSource(listOf(...))` (see
 * [de.sluit.mediatracker.games.persistence.GamesBackupSource]); this class never sees the domain's own entities
 * or value objects, only the DB columns.
 *
 * **Export** is a plain `selectAll`, ordered by each table's primary key for a deterministic dump; row keys are
 * the DB column names ([Column.name]), values are read through the column type and normalised to
 * String/Long/Double/Boolean/null (an `integer` column comes back as [Long], matching the JSON `Any?` union
 * `backup/api` writes numbers as).
 *
 * **Import** validates the whole payload before writing anything ([validate]: unknown or missing column, a value
 * that does not coerce to the column's type, or two rows sharing a primary key, all throw
 * [InvalidValueException]/400 and leave the database untouched), then runs every table's insert in one
 * transaction: insert-if-absent by primary key ("insert if not exists", which is also what makes re-importing
 * the V002-seeded platforms a no-op), never `INSERT IGNORE` since MariaDB would silently swallow a foreign-key
 * violation along with it. Primary keys are compared case-insensitively and ignoring trailing spaces (both
 * against existing rows and within the payload itself), matching the `CHAR`/`VARCHAR` collation the schema
 * uses. A constraint violation from the database itself (SQLState class `23`: a unique clash, a dangling foreign
 * key) rolls back every table this source just touched and is rethrown as an [InvalidValueException] naming the
 * table, with the driver's own message only logged, never echoed to the client; any other SQL exception is
 * rethrown as-is (500).
 *
 * Deliberately column-level only: the domain's own value-class rules (e.g. `Rating`'s quarter-star step) are
 * not re-checked on import, since this restores a previous export of the same schema rather than arbitrary
 * input (ADR 0027).
 */
open class ExposedBackupSource(private val tables: List<Table>) : BackupSource {
    private val logger = LoggerFactory.getLogger(ExposedBackupSource::class.java)

    override val tableNames: List<String> = tables.map { it.tableName }

    override suspend fun export(): Map<String, List<BackupRow>> = dbQuery {
        tables.associate { table -> table.tableName to table.exportRows() }
    }

    /** Pure validation, no database access: [coerceRows] both coerces and checks, the result is discarded. */
    override fun validate(tables: Map<String, List<BackupRow>>) {
        coerceAll(tables)
    }

    override suspend fun import(tables: Map<String, List<BackupRow>>): Map<String, TableImportResult> {
        // Re-validated (and coerced to the columns' own Kotlin types) before any write, defensively:
        // BackupService already calls validate() on every source before it imports any of them, so a bad row in
        // one table never leaves a partial write behind in another.
        val coerced = coerceAll(tables)
        return dbQuery {
            this@ExposedBackupSource.tables.associate { table ->
                table.tableName to
                    table.importRows(coerced.getValue(table))
            }
        }
    }

    private fun coerceAll(tables: Map<String, List<BackupRow>>): Map<Table, List<Map<Column<*>, Any?>>> =
        this.tables.associateWith { table -> table.coerceRows(tables[table.tableName].orEmpty()) }

    private fun Table.exportRows(): List<BackupRow> {
        val order: Array<Pair<Expression<*>, SortOrder>> =
            primaryKey?.columns.orEmpty().map { (it as Expression<*>) to SortOrder.ASC }.toTypedArray()
        return selectAll().orderBy(*order).map { row -> columns.associate { it.name to row.toBackupValue(it) } }
    }

    private fun ResultRow.toBackupValue(column: Column<*>): Any? = when (val value = this[column]) {
        null -> null

        is Int -> value.toLong()

        is Long, is Double, is Boolean, is String -> value

        else -> error(
            "Unsupported backup column value type ${value::class} for ${column.table.tableName}.${column.name}",
        )
    }

    private fun Table.coerceRows(rows: List<BackupRow>): List<Map<Column<*>, Any?>> {
        val byName = columns.associateBy { it.name }
        val coerced = rows.map { row ->
            val unknown = row.keys - byName.keys
            if (unknown.isNotEmpty()) {
                throw InvalidValueException(tableName, "unknown column(s): ${unknown.sorted()}")
            }
            val missing = byName.keys - row.keys
            if (missing.isNotEmpty()) {
                throw InvalidValueException(tableName, "missing column(s): ${missing.sorted()}")
            }
            byName.values.associateWith { column -> column.coerce(tableName, row.getValue(column.name)) }
        }
        checkNoDuplicatePrimaryKeys(coerced)
        return coerced
    }

    /**
     * Two rows of the same payload sharing a primary key would otherwise both "win" the insert-if-absent check
     * in [importRows] and one silently disappear; caught here instead, before any write. Compared the same way
     * as [importRows] compares against existing rows: normalised, since `CHAR`/`VARCHAR` columns use a
     * case-insensitive, pad-space collation.
     */
    private fun Table.checkNoDuplicatePrimaryKeys(rows: List<Map<Column<*>, Any?>>) {
        val pkColumns = primaryKey?.columns.orEmpty().toList()
        if (pkColumns.isEmpty()) return
        val seen = mutableSetOf<List<Any?>>()
        rows.forEach { row ->
            val key = pkColumns.map { row[it] }.normalisedKey()
            if (!seen.add(key)) {
                throw InvalidValueException(tableName, "duplicate primary key in payload")
            }
        }
    }

    private fun Column<*>.coerce(tableName: String, raw: Any?): Any? {
        val field = "$tableName.$name"
        if (raw == null) {
            if (!columnType.nullable) throw InvalidValueException(field, "must not be null")
            return null
        }
        return when (val type = columnType) {
            is BooleanColumnType -> raw as? Boolean ?: throw InvalidValueException(field, "must be a boolean")

            is DoubleColumnType ->
                (raw as? Number)?.toDouble() ?: throw InvalidValueException(field, "must be a number")

            is IntegerColumnType -> raw.coerceToInt(field)

            is CharColumnType ->
                (raw as? String ?: throw InvalidValueException(field, "must be a string"))
                    .also { it.checkLength(field, type.colLength) }

            is VarCharColumnType ->
                (raw as? String ?: throw InvalidValueException(field, "must be a string"))
                    .also { it.checkLength(field, type.colLength) }

            is TextColumnType -> raw as? String ?: throw InvalidValueException(field, "must be a string")

            else -> error("Unsupported backup column type ${columnType::class} for $field")
        }
    }

    private fun String.checkLength(field: String, colLength: Int) {
        val length = codePointCount(0, length)
        if (length > colLength) throw InvalidValueException(field, "longer than $colLength characters")
    }

    private fun Any.coerceToInt(field: String): Int = when (this) {
        is Int -> this

        is Long -> if (this in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) {
            toInt()
        } else {
            throw InvalidValueException(field, "out of range for an integer column")
        }

        else -> throw InvalidValueException(field, "must be an integer")
    }

    /** Selects this table's rows whose primary key is not already present, then batch-inserts only those. */
    private fun Table.importRows(rows: List<Map<Column<*>, Any?>>): TableImportResult {
        if (rows.isEmpty()) return TableImportResult(inserted = 0, skipped = 0)
        val pkColumns = primaryKey?.columns.orEmpty().toList()
        val existing: Set<List<Any?>> = if (pkColumns.isEmpty()) {
            emptySet()
        } else {
            select(pkColumns).map { row -> pkColumns.map { row[it] }.normalisedKey() }.toSet()
        }
        val (toSkip, toInsert) = rows.partition { row ->
            pkColumns.isNotEmpty() && pkColumns.map { row[it] }.normalisedKey() in existing
        }
        if (toInsert.isNotEmpty()) {
            try {
                batchInsert(toInsert) { row ->
                    row.forEach { (column, value) ->
                        @Suppress("UNCHECKED_CAST")
                        this[column as Column<Any?>] = value
                    }
                }
            } catch (e: ExposedSQLException) {
                if (e.sqlState?.startsWith("23") != true) throw e
                logger.warn("Backup import into '$tableName' violated a constraint", e)
                throw InvalidValueException(
                    tableName,
                    "violates a constraint (duplicate key or missing referenced row)",
                )
            }
        }
        return TableImportResult(inserted = toInsert.size, skipped = toSkip.size)
    }

    /**
     * `CHAR`/`VARCHAR` columns use a case-insensitive, pad-space collation, so two primary-key tuples that only
     * differ by case or trailing spaces refer to the same row as far as MariaDB is concerned.
     */
    private fun List<Any?>.normalisedKey(): List<Any?> = map { value ->
        if (value is String) value.lowercase().trimEnd() else value
    }

    companion object {
        /**
         * The column types [coerce] can turn a JSON value into; single source of truth checked against by
         * `BackupCoverageTest` so a future column type that [coerce] cannot handle (an unsupported type is a
         * 500, not a 400, see [coerce]) fails a test instead of only failing at import time.
         */
        fun supports(columnType: IColumnType<*>): Boolean = when (columnType) {
            is BooleanColumnType,
            is DoubleColumnType,
            is IntegerColumnType,
            is CharColumnType,
            is VarCharColumnType,
            is TextColumnType,
            -> true

            else -> false
        }
    }
}
