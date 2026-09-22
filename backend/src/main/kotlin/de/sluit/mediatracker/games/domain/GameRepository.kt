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

    /** Cheap existence check for a nested resource (e.g. expansions); unlike [findById] it loads no platforms. */
    suspend fun exists(id: GameId): Boolean

    /** @return false when no row with the game's id exists (anymore). */
    suspend fun update(game: Game): Boolean

    /** @return number of deleted rows (0 or 1). */
    suspend fun deleteById(id: GameId): Int

    /** Ordered by title, then id, so paging is deterministic. */
    suspend fun findPage(request: PageRequest): Page<Game>

    /**
     * Filtered and/or fulltext-searched listing. With a [term], fulltext matches on title and description order
     * games with a title hit first, then by the weighted score, then title, then id; without one, the ordering
     * is title, then id, same as [findPage]. [filters] AND across categories and OR inside one (an `IN` list,
     * or `IS NULL` checks for the `missing` category); an empty [GameFilters] applies no predicate. A term that contains no searchable word behaves as if it were absent.
     */
    suspend fun search(term: SearchTerm?, filters: GameFilters, request: PageRequest): Page<Game>

    /**
     * The distinct values each filter category currently has across all games, unordered. Only the four
     * categories the REST filters expose; `missing` is never populated, it has no lookup values to offer
     * (decision record 0022).
     */
    suspend fun findUsedFilterValues(): GameFilters
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
