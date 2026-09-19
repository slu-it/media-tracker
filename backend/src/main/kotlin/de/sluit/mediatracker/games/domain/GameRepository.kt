package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Persistence port of the games domain. Implemented in `games.persistence`; the domain never imports that
 * package, so dependencies point inward only.
 */
interface GameRepository {
    suspend fun insert(game: Game)

    suspend fun findById(id: GameId): Game?

    /** @return false when no row with the game's id exists (anymore). */
    suspend fun update(game: Game): Boolean

    /** @return number of deleted rows (0 or 1). */
    suspend fun deleteById(id: GameId): Int

    /** Ordered by title, then id, so paging is deterministic. */
    suspend fun findPage(request: PageRequest): Page<Game>

    /**
     * Fulltext matches on title and description, games with a title hit first, then by the weighted score, then
     * title, then id. A term that contains no searchable word behaves like [findPage].
     */
    suspend fun search(term: SearchTerm, request: PageRequest): Page<Game>
}

/**
 * Persistence port of the (mostly static, seeded) game platforms. Implemented in `games.persistence`; the
 * domain never imports that package, so dependencies point inward only.
 */
interface GamePlatformRepository {
    /** Ordered by label. */
    suspend fun findAll(): List<GamePlatform>

    suspend fun findByIds(ids: Set<GamePlatformId>): List<GamePlatform>
}
