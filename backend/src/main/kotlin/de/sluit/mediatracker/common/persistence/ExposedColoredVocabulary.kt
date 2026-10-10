package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.RenameOutcome
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.uuid.Uuid

/**
 * Exposed/JDBC logic of an editable vocabulary of labelled, coloured entries (book types, game platforms): a
 * [table] with a char(36) [id], a [label] column carrying a unique index (uca1400_ai_ci, so case and accent
 * variants of a label are the same label) and a [color] column, referenced by a [junction] table through
 * [junctionVocabColumn] with `ON DELETE RESTRICT`. [toEntity] builds the kind's entity from a row's id, label and
 * colour strings; values arrive already validated, this class neither trims nor uppercases.
 */
class ExposedColoredVocabulary<E>(
    private val table: Table,
    private val id: Column<String>,
    private val label: Column<String>,
    private val color: Column<String>,
    private val junction: Table,
    private val junctionVocabColumn: Column<String>,
    private val toEntity: (String, String, String) -> E,
) {
    /** One query: [table] LEFT JOIN [junction], `COUNT(junction column)` (0 for an unused entry), by label, id. */
    suspend fun findSummaries(): List<Pair<E, Int>> = dbQuery {
        val count = junctionVocabColumn.count()
        (table leftJoin junction)
            .select(id, label, color, count)
            .groupBy(id, label, color)
            .orderBy(label to SortOrder.ASC, id to SortOrder.ASC)
            .map { it.toEntity() to it[count].toInt() }
    }

    /**
     * Inserts a new entry. Unlike a free-text vocabulary, a taken label is [CreateOutcome.Taken], never success.
     * A concurrent insert of the same label can win the unique index between the lookup and the insert; the
     * loser's violation is answered by a locking re-read of the winner (see [findRowByLabel]).
     */
    suspend fun create(label: String, color: String): CreateOutcome<E> = create(label, color) {}

    /** [create] with a test seam: [afterLookup] runs right after the lookup found no holder of [label]. */
    internal suspend fun create(label: String, color: String, afterLookup: () -> Unit): CreateOutcome<E> = dbQuery {
        findOther(label, null)?.let { return@dbQuery CreateOutcome.Taken(it) }
        afterLookup()
        val newId = Uuid.random().toString()
        try {
            table.insert {
                it[id] = newId
                it[this@ExposedColoredVocabulary.label] = label
                it[this@ExposedColoredVocabulary.color] = color
            }
            CreateOutcome.Created(toEntity(newId, label, color))
        } catch (e: ExposedSQLException) {
            if (!e.isDuplicateEntry()) throw e
            findOther(label, null, locked = true)?.let { CreateOutcome.Taken(it) } ?: throw e
        }
    }

    /**
     * Updates the given fields of entry [entryId] (`null`: keep) in one transaction. The row is locked `FOR UPDATE`
     * first, so concurrent updates of it serialise. Another entry holding the new label is
     * [RenameOutcome.Taken]; the entry's own row is excluded, so a case-only change of its own label is a plain
     * update. A race on the unique index is handled as in [create].
     */
    suspend fun update(entryId: String, label: String?, color: String?): RenameOutcome<E> =
        update(entryId, label, color) {}

    /** [update] with a test seam, see [create]. */
    internal suspend fun update(
        entryId: String,
        label: String?,
        color: String?,
        afterLookup: () -> Unit,
    ): RenameOutcome<E> = dbQuery {
        val row = table.selectAll().where { id eq entryId }.forUpdate().singleOrNull()
            ?: return@dbQuery RenameOutcome.NotFound
        if (label != null) findOther(label, entryId)?.let { return@dbQuery RenameOutcome.Taken(it) }
        afterLookup()
        val newLabel = label ?: row[this@ExposedColoredVocabulary.label]
        val newColor = color ?: row[this@ExposedColoredVocabulary.color]
        try {
            table.update({ id eq entryId }) {
                it[this@ExposedColoredVocabulary.label] = newLabel
                it[this@ExposedColoredVocabulary.color] = newColor
            }
            RenameOutcome.Renamed(toEntity(entryId, newLabel, newColor))
        } catch (e: ExposedSQLException) {
            if (label == null || !e.isDuplicateEntry()) throw e
            findOther(label, entryId, locked = true)?.let { RenameOutcome.Taken(it) } ?: throw e
        }
    }

    /** One transaction: existence check, link check, delete (see [deleteUnusedVocabularyEntry]). */
    suspend fun delete(entryId: String): DeleteOutcome = dbQuery {
        deleteUnusedVocabularyEntry(table, id, junction, junctionVocabColumn, entryId)
    }

    private fun findOther(label: String, exceptId: String?, locked: Boolean = false): E? =
        table.findRowByLabel(this.label, id, label, exceptId, locked)?.toEntity()

    private fun ResultRow.toEntity(): E = toEntity(this[id], this[label], this[color])
}
