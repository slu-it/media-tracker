package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.VocabularyName
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.math.BigDecimal

/**
 * Folds the series row [sourceId] into [targetId] over a `(item, series, position)` [junction] (book and game
 * series). Must run inside a transaction. Both series rows are locked `FOR UPDATE` in id order (so two opposite
 * merges cannot deadlock). Links of the source whose item is not yet linked to the target are re-pointed by
 * insert, keeping their position; an item in both keeps the target's position, or the source's when the
 * target's is null. Then every source link and the source row are deleted. [toEntity] builds the merged
 * outcome's entry from the target's name.
 */
fun <E> mergeSeriesEntries(
    vocabTable: Table,
    vocabId: Column<String>,
    vocabName: Column<String>,
    junction: Table,
    itemColumn: Column<String>,
    seriesColumn: Column<String>,
    positionColumn: Column<BigDecimal?>,
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

    val targetPositions = junction.selectAll()
        .where { seriesColumn eq targetId }
        .associate { it[itemColumn] to it[positionColumn] }
    val sourceLinks = junction.selectAll()
        .where { seriesColumn eq sourceId }
        .map { it[itemColumn] to it[positionColumn] }
    val (shared, moved) = sourceLinks.partition { (item, _) -> item in targetPositions }

    junction.batchInsert(moved) { (item, position) ->
        this[itemColumn] = item
        this[seriesColumn] = targetId
        this[positionColumn] = position
    }
    shared.forEach { (item, position) ->
        if (position != null && targetPositions.getValue(item) == null) {
            junction.update({ (itemColumn eq item) and (seriesColumn eq targetId) }) {
                it[positionColumn] = position
            }
        }
    }
    junction.deleteWhere { seriesColumn eq sourceId }
    vocabTable.deleteWhere { vocabId eq sourceId }
    return MergeOutcome.Merged(toEntity(VocabularyName(targetRow[vocabName])))
}
