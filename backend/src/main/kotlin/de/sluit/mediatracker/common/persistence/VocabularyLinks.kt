package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.VocabularyName
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll

/**
 * Deletes the vocabulary row [id] unless a [junction] row still references it. Must run inside a transaction.
 * The junction FK is `ON DELETE RESTRICT`, so a link added concurrently after the check makes the delete fail
 * ([orOnForeignKeyViolation]) instead of orphaning anything.
 */
fun deleteUnusedVocabularyEntry(
    vocabTable: Table,
    vocabId: Column<String>,
    junction: Table,
    vocabColumn: Column<String>,
    id: String,
): DeleteOutcome = when {
    vocabTable.selectAll().where { vocabId eq id }.empty() -> DeleteOutcome.NOT_FOUND

    !junction.selectAll().where { vocabColumn eq id }.empty() -> DeleteOutcome.IN_USE

    else -> orOnForeignKeyViolation(DeleteOutcome.IN_USE) {
        vocabTable.deleteWhere { vocabId eq id }
        DeleteOutcome.DELETED
    }
}

/**
 * Folds the vocabulary row [sourceId] into [targetId] over a plain `(item, vocabulary)` [junction] (no extra
 * columns on the link). Must run inside a transaction. Both vocabulary rows are locked `FOR UPDATE` in id order
 * (so two opposite merges cannot deadlock). Source links whose item is not yet linked to the target are
 * re-pointed by insert, then every source link and the source row are deleted. [toEntity] builds the merged
 * outcome's entry from the target's name.
 */
fun <E> mergeVocabularyEntries(
    vocabTable: Table,
    vocabId: Column<String>,
    vocabName: Column<String>,
    junction: Table,
    itemColumn: Column<String>,
    vocabColumn: Column<String>,
    sourceId: String,
    targetId: String,
    toEntity: (VocabularyName) -> E,
): MergeOutcome<E> {
    val rows = vocabTable.selectAll()
        .where { vocabId inList listOf(sourceId, targetId) }
        .orderBy(vocabId to SortOrder.ASC)
        .forUpdate()
        .associateBy { it[vocabId] }
    val targetRow = rows[targetId]
    if (rows[sourceId] == null) return MergeOutcome.SourceNotFound
    if (targetRow == null) return MergeOutcome.TargetNotFound

    val alreadyLinked = junction.select(itemColumn)
        .where { vocabColumn eq targetId }
        .map { it[itemColumn] }
        .toSet()
    val moved = junction.select(itemColumn)
        .where { vocabColumn eq sourceId }
        .map { it[itemColumn] }
        .filterNot { it in alreadyLinked }
    junction.batchInsert(moved) { item ->
        this[itemColumn] = item
        this[vocabColumn] = targetId
    }
    junction.deleteWhere { vocabColumn eq sourceId }
    vocabTable.deleteWhere { vocabId eq sourceId }
    return MergeOutcome.Merged(toEntity(VocabularyName(targetRow[vocabName])))
}
