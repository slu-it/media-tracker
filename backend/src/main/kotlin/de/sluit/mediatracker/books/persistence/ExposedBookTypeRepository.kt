package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookType
import de.sluit.mediatracker.books.domain.BookTypeId
import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.books.domain.BookTypeRepository
import de.sluit.mediatracker.books.domain.BookTypeSummary
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.persistence.ExposedColoredVocabulary
import de.sluit.mediatracker.common.persistence.dbQuery
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.uuid.Uuid

/**
 * [BookTypeRepository] on Exposed/JDBC. The rows are seeded by the migration and editable by the user; the
 * summaries, create, update and delete logic lives in [ExposedColoredVocabulary], bound here to [BookTypesTable].
 */
class ExposedBookTypeRepository : BookTypeRepository {
    private val vocabulary = ExposedColoredVocabulary(
        table = BookTypesTable,
        id = BookTypesTable.id,
        label = BookTypesTable.label,
        color = BookTypesTable.associatedColor,
        junction = BookToTypeTable,
        junctionVocabColumn = BookToTypeTable.typeId,
        toEntity = ::toBookType,
    )

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

    override suspend fun findSummaries(): List<BookTypeSummary> =
        vocabulary.findSummaries().map { (type, count) -> BookTypeSummary(type, count) }

    override suspend fun create(label: BookTypeLabel, color: HexColor): CreateOutcome<BookType> =
        vocabulary.create(label.value, color.value)

    override suspend fun update(id: BookTypeId, label: BookTypeLabel?, color: HexColor?): RenameOutcome<BookType> =
        vocabulary.update(id.toString(), label?.value, color?.value)

    override suspend fun delete(id: BookTypeId): DeleteOutcome = vocabulary.delete(id.toString())

    /** Test seam, see [ExposedColoredVocabulary.create]. */
    internal suspend fun create(
        label: BookTypeLabel,
        color: HexColor,
        afterLookup: () -> Unit,
    ): CreateOutcome<BookType> = vocabulary.create(label.value, color.value, afterLookup)

    /** Test seam, see [ExposedColoredVocabulary.update]. */
    internal suspend fun update(
        id: BookTypeId,
        label: BookTypeLabel?,
        color: HexColor?,
        afterLookup: () -> Unit,
    ): RenameOutcome<BookType> = vocabulary.update(id.toString(), label?.value, color?.value, afterLookup)

    private fun ResultRow.toBookType() = toBookType(
        this[BookTypesTable.id],
        this[BookTypesTable.label],
        this[BookTypesTable.associatedColor],
    )
}

private fun toBookType(id: String, label: String, color: String) =
    BookType(BookTypeId(Uuid.parseHexDash(id)), BookTypeLabel(label), HexColor(color))
