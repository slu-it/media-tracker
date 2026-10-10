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
import de.sluit.mediatracker.common.persistence.mergeVocabularyEntries
import de.sluit.mediatracker.games.domain.GameDeveloper
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameDeveloperRepository
import de.sluit.mediatracker.games.domain.GameDeveloperSummary
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.leftJoin
import org.jetbrains.exposed.v1.jdbc.select
import kotlin.uuid.Uuid

/**
 * [GameDeveloperRepository] on Exposed/JDBC: a vocabulary the user grows on the fly (MT-025, ADR 0029), unlike
 * the seeded [GamePlatformsTable]. Its `name` column carries the `uq_game_developers_name` unique index. The
 * search, lookup and race-safe create logic lives in [ExposedNameVocabulary]; this class only binds it to
 * [GameDevelopersTable] and the [GameDeveloper] entity.
 */
class ExposedGameDeveloperRepository : GameDeveloperRepository {
    private val vocabulary = ExposedNameVocabulary(
        table = GameDevelopersTable,
        id = GameDevelopersTable.id,
        name = GameDevelopersTable.name,
        toEntity = { id, name -> GameDeveloper(GameDeveloperId(Uuid.parseHexDash(id)), name) },
    )

    override suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameDeveloper> =
        vocabulary.search(term, limit)

    override suspend fun findByIds(ids: Set<GameDeveloperId>): List<GameDeveloper> =
        vocabulary.findByIds(ids.map { it.toString() }.toSet())

    /** One query: `game_developers LEFT JOIN game_to_developer`, `COUNT(game_id)` (0 for unreferenced), by name, id. */
    override suspend fun findSummaries(): List<GameDeveloperSummary> = dbQuery {
        val count = GameToDeveloperTable.gameId.count()
        (GameDevelopersTable leftJoin GameToDeveloperTable)
            .select(GameDevelopersTable.id, GameDevelopersTable.name, count)
            .groupBy(GameDevelopersTable.id, GameDevelopersTable.name)
            .orderBy(GameDevelopersTable.name to SortOrder.ASC, GameDevelopersTable.id to SortOrder.ASC)
            .map {
                GameDeveloperSummary(
                    developer = GameDeveloper(
                        GameDeveloperId(Uuid.parseHexDash(it[GameDevelopersTable.id])),
                        VocabularyName(it[GameDevelopersTable.name]),
                    ),
                    gameCount = it[count].toInt(),
                )
            }
    }

    override suspend fun create(name: VocabularyName): VocabularyCreation<GameDeveloper> = vocabulary.create(name)

    /** One transaction: existence check, link check, delete (see [deleteUnusedVocabularyEntry]). */
    override suspend fun delete(id: GameDeveloperId): DeleteOutcome = dbQuery {
        deleteUnusedVocabularyEntry(
            vocabTable = GameDevelopersTable,
            vocabId = GameDevelopersTable.id,
            junction = GameToDeveloperTable,
            vocabColumn = GameToDeveloperTable.developerId,
            id = id.toString(),
        )
    }

    override suspend fun rename(id: GameDeveloperId, name: VocabularyName): RenameOutcome<GameDeveloper> =
        vocabulary.rename(id.toString(), name)

    /** One transaction, see [mergeVocabularyEntries]. */
    override suspend fun merge(sourceId: GameDeveloperId, targetId: GameDeveloperId): MergeOutcome<GameDeveloper> =
        dbQuery {
            mergeVocabularyEntries(
                vocabTable = GameDevelopersTable,
                vocabId = GameDevelopersTable.id,
                vocabName = GameDevelopersTable.name,
                junction = GameToDeveloperTable,
                itemColumn = GameToDeveloperTable.gameId,
                vocabColumn = GameToDeveloperTable.developerId,
                sourceId = sourceId.toString(),
                targetId = targetId.toString(),
                toEntity = { GameDeveloper(targetId, it) },
            )
        }

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(
        name: VocabularyName,
        afterInitialLookup: () -> Unit,
    ): VocabularyCreation<GameDeveloper> = vocabulary.create(name, afterInitialLookup)

    /** Test seam, see [ExposedNameVocabulary.rename]. */
    internal suspend fun rename(
        id: GameDeveloperId,
        name: VocabularyName,
        afterLookup: () -> Unit,
    ): RenameOutcome<GameDeveloper> = vocabulary.rename(id.toString(), name, afterLookup)
}
