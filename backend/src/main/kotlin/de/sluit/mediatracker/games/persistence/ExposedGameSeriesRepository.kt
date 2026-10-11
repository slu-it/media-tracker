package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.common.persistence.deleteUnusedVocabularyEntry
import de.sluit.mediatracker.common.persistence.mergeSeriesEntries
import de.sluit.mediatracker.games.domain.GameSeries
import de.sluit.mediatracker.games.domain.GameSeriesId
import de.sluit.mediatracker.games.domain.GameSeriesRepository
import de.sluit.mediatracker.games.domain.GameSeriesSummary
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.jdbc.select
import kotlin.uuid.Uuid

/**
 * [GameSeriesRepository] on Exposed/JDBC: a vocabulary the user grows on the fly, unlike the seeded
 * [GameDevelopersTable]. Its `name` column carries the `uq_game_series_name` unique index. The search, lookup and
 * race-safe create logic lives in [ExposedNameVocabulary]; this class only binds it to [GameSeriesTable] and
 * the [GameSeries] entity.
 */
class ExposedGameSeriesRepository : GameSeriesRepository {
    private val vocabulary = ExposedNameVocabulary(
        table = GameSeriesTable,
        id = GameSeriesTable.id,
        name = GameSeriesTable.name,
        toEntity = { id, name -> GameSeries(GameSeriesId(Uuid.parseHexDash(id)), name) },
    )

    override suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameSeries> =
        vocabulary.search(term, limit)

    override suspend fun findByIds(ids: Set<GameSeriesId>): List<GameSeries> =
        vocabulary.findByIds(ids.map { it.toString() }.toSet())

    /** One query: `game_series LEFT JOIN game_to_series`, `COUNT(game_id)` (0 for unreferenced), by name, id. */
    override suspend fun findSummaries(): List<GameSeriesSummary> = dbQuery {
        val count = GameToSeriesTable.gameId.count()
        (GameSeriesTable leftJoin GameToSeriesTable)
            .select(GameSeriesTable.id, GameSeriesTable.name, count)
            .groupBy(GameSeriesTable.id, GameSeriesTable.name)
            .orderBy(GameSeriesTable.name to SortOrder.ASC, GameSeriesTable.id to SortOrder.ASC)
            .map {
                GameSeriesSummary(
                    series = GameSeries(
                        GameSeriesId(Uuid.parseHexDash(it[GameSeriesTable.id])),
                        VocabularyName(it[GameSeriesTable.name]),
                    ),
                    gameCount = it[count].toInt(),
                )
            }
    }

    override suspend fun create(name: VocabularyName): VocabularyCreation<GameSeries> = vocabulary.create(name)

    /** One transaction: existence check, link check, delete (see [deleteUnusedVocabularyEntry]). */
    override suspend fun delete(id: GameSeriesId): DeleteOutcome = dbQuery {
        deleteUnusedVocabularyEntry(
            vocabTable = GameSeriesTable,
            vocabId = GameSeriesTable.id,
            junction = GameToSeriesTable,
            vocabColumn = GameToSeriesTable.seriesId,
            id = id.toString(),
        )
    }

    override suspend fun rename(id: GameSeriesId, name: VocabularyName): RenameOutcome<GameSeries> =
        vocabulary.rename(id.toString(), name)

    /**
     * One transaction, see [mergeSeriesEntries]: a game in both series keeps the target's position, or the
     * source's when the target's is null.
     */
    override suspend fun merge(sourceId: GameSeriesId, targetId: GameSeriesId): MergeOutcome<GameSeries> = dbQuery {
        mergeSeriesEntries(
            vocabTable = GameSeriesTable,
            vocabId = GameSeriesTable.id,
            vocabName = GameSeriesTable.name,
            junction = GameToSeriesTable,
            itemColumn = GameToSeriesTable.gameId,
            seriesColumn = GameToSeriesTable.seriesId,
            positionColumn = GameToSeriesTable.position,
            sourceId = sourceId.toString(),
            targetId = targetId.toString(),
            toEntity = { GameSeries(targetId, it) },
        )
    }

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(name: VocabularyName, afterInitialLookup: () -> Unit): VocabularyCreation<GameSeries> =
        vocabulary.create(name, afterInitialLookup)
}
