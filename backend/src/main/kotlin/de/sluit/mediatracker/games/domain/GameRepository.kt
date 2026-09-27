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
     * Filtered and/or fulltext-searched listing. [sort] (MT-026, default [GameSort.TITLE]) picks the ordering;
     * with a [term] and the default [GameSort.TITLE], fulltext matches on title and description order games
     * with a title hit first, then by the weighted score, then title, then id, overridden entirely by any
     * other [sort] (the fulltext match itself still filters). Without a [term] the ordering is [sort] alone,
     * [GameSort.TITLE] being title, then id, same as [findPage]. [filters] AND across categories and OR inside
     * one (an `IN` list, `IS NULL` checks for the `missing` category, or `IS NOT NULL` for [GameFilters.ratedOnly]);
     * an empty [GameFilters] applies no predicate. A term that contains no searchable word behaves as if it were
     * absent.
     */
    suspend fun search(
        term: SearchTerm?,
        filters: GameFilters,
        request: PageRequest,
        sort: GameSort = GameSort.TITLE,
    ): Page<Game>

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

/** What [GameDeveloperRepository.create] found: the developer, plus whether it was just inserted. */
data class GameDeveloperCreation(val developer: GameDeveloper, val created: Boolean)

/**
 * Persistence port of the user-grown developer vocabulary (MT-025, ADR 0029). Implemented in
 * `games.persistence`; the domain never imports that package, so dependencies point inward only.
 */
interface GameDeveloperRepository {
    /**
     * Fulltext prefix search on the name, ordered by score, then name, then id; a blank/`null` [term] lists
     * developers alphabetically instead. Capped at [limit].
     */
    suspend fun search(term: SearchTerm?, limit: DeveloperSearchLimit): List<GameDeveloper>

    suspend fun findByIds(ids: Set<GameDeveloperId>): List<GameDeveloper>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: DeveloperName): GameDeveloperCreation
}
