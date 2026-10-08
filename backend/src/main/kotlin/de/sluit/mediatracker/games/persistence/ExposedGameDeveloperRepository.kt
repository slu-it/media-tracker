package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
import de.sluit.mediatracker.games.domain.GameDeveloper
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameDeveloperRepository
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

    override suspend fun create(name: VocabularyName): VocabularyCreation<GameDeveloper> = vocabulary.create(name)

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(
        name: VocabularyName,
        afterInitialLookup: () -> Unit,
    ): VocabularyCreation<GameDeveloper> = vocabulary.create(name, afterInitialLookup)
}
