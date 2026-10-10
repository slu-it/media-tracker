package de.sluit.mediatracker.common.persistence

import org.jetbrains.exposed.v1.exceptions.ExposedSQLException

/** MariaDB `ER_ROW_IS_REFERENCED_2`: a parent row cannot be deleted because a child row still references it. */
@PublishedApi
internal const val ER_ROW_IS_REFERENCED: Int = 1451

/** MariaDB `ER_DUP_ENTRY`: an insert or update violated a unique index. */
private const val ER_DUP_ENTRY: Int = 1062

/** Whether this is a duplicate-key violation (MariaDB 1062, SQLState class 23 "integrity constraint violation"). */
internal fun ExposedSQLException.isDuplicateEntry(): Boolean = errorCode == ER_DUP_ENTRY && sqlState.startsWith("23")

/**
 * Runs [block] and returns [onViolation] if it fails on a restricting foreign key (MariaDB 1451, SQLState
 * 23000), e.g. a delete that lost a race against a concurrently committed child row. InnoDB rolls back only the
 * failed statement, so the surrounding transaction stays usable and commits normally. Anything else rethrows.
 */
inline fun <T> orOnForeignKeyViolation(onViolation: T, block: () -> T): T = try {
    block()
} catch (e: ExposedSQLException) {
    if (e.errorCode == ER_ROW_IS_REFERENCED && e.sqlState.startsWith("23")) onViolation else throw e
}
