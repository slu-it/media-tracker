package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.books.domain.BookTypeRepository
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.persistence.dbQuery
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.uuid.Uuid

/** [BookTypeRepository] on Exposed/JDBC. The rows are seeded by the migration and essentially static. */
class ExposedBookTypeRepository : BookTypeRepository {
    override suspend fun findAll(): List<BookType> = dbQuery {
        BookTypesTable.selectAll().orderBy(BookTypesTable.label to SortOrder.ASC).map { it.toBookType() }
    }

    override suspend fun findByIds(ids: Set<BookTypeId>): List<BookType> = dbQuery {
        if (ids.isEmpty()) {
            emptyList()
        } else {
            BookTypesTable.selectAll()
                .where { BookTypesTable.id inList ids.map { it.toString() } }
                .map { it.toBookType() }
        }
    }

    private fun ResultRow.toBookType() = BookType(
        id = BookTypeId(Uuid.parseHexDash(this[BookTypesTable.id])),
        label = BookTypeLabel(this[BookTypesTable.label]),
        color = HexColor(this[BookTypesTable.associatedColor]),
    )
}
