package de.sluit.mediatracker.common.persistence

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.selectAll

/**
 * The row of this table whose [nameColumn] equals [name] (under the column's collation, so case/accent variants
 * match) and whose id is not [exceptId] (`null`: no exclusion). Must run inside a transaction. With [locked] the
 * read is a `LOCK IN SHARE MODE` one, which sees the latest committed row despite the REPEATABLE READ snapshot;
 * used to answer a unique-index violation from a concurrent writer, see [ExposedNameVocabulary.create].
 */
internal fun Table.findRowByLabel(
    nameColumn: Column<String>,
    idColumn: Column<String>,
    name: String,
    exceptId: String?,
    locked: Boolean = false,
): ResultRow? {
    val query = selectAll().where {
        if (exceptId == null) (nameColumn eq name) else (nameColumn eq name) and (idColumn neq exceptId)
    }
    return (if (locked) query.forUpdate(ForUpdateOption.MariaDB.LockInShareMode) else query).singleOrNull()
}
