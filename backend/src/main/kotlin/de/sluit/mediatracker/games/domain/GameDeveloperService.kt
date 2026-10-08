package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit

/**
 * Business use cases behind `GET`/`POST /game-developers`. [GameService] resolves `developerIds` itself through
 * [GameDeveloperRepository] directly (mirroring how it resolves `platformIds`); this service exists for the
 * two operations a game does not need: searching the vocabulary and growing it.
 */
class GameDeveloperService(private val developers: GameDeveloperRepository) {
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameDeveloper> =
        developers.search(term, limit)

    /** Idempotent: an existing case-insensitive name match is returned instead of a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<GameDeveloper> = developers.create(name)
}
