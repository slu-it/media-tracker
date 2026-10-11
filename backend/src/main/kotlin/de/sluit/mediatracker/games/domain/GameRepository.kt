package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.MergeOutcome
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit

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
     * with a [term] and the default [GameSort.TITLE], a game matches on its title only (a title fulltext hit or a
     * title prefix LIKE match); prefix hits come first, then relevance, then title, then id, overridden entirely
     * by any other [sort] (the match itself still filters). Without a [term] the ordering is [sort] alone,
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
     * The distinct values each filter category currently has across all games, unordered, plus the number of
     * games per platform. Only the four categories the REST filters expose; `missing` is never populated, it has no lookup values to offer
     * (decision record 0022).
     */
    suspend fun findUsedFilterValues(): UsedGameFilterValues

    /**
     * All games linked to [developerId], unpaged, in the order of [GameSort.RELEASE_ASC]: release year, then
     * release date (games without a date last within a year), then title, then id.
     */
    suspend fun findByDeveloper(developerId: GameDeveloperId): List<Game>

    /**
     * All games linked to [seriesId], unpaged: ordered by the game's position in that series ascending, games
     * without a position last, then title, then id.
     */
    suspend fun findBySeries(seriesId: GameSeriesId): List<Game>
}

/**
 * Persistence port of the game platforms (seeded by the migration, editable by the user). Implemented in
 * `games.persistence`; the domain never imports that package, so dependencies point inward only.
 */
interface GamePlatformRepository {
    /** Ordered by label. */
    suspend fun findAll(): List<GamePlatform>

    suspend fun findByIds(ids: Set<GamePlatformId>): List<GamePlatform>

    /** Every platform including those without games, with their game count; ordered by label, then id. Unpaged. */
    suspend fun findSummaries(): List<GamePlatformSummary>

    /** [CreateOutcome.Taken] when another platform carries the label (case/accent-insensitively). */
    suspend fun create(label: PlatformLabel, color: HexColor): CreateOutcome<GamePlatform>

    /**
     * Changes the label and/or colour (`null`: keep). [RenameOutcome.Taken] when another platform carries the new
     * label; a spelling that only differs from the platform's own label that way is a plain update.
     */
    suspend fun update(id: GamePlatformId, label: PlatformLabel?, color: HexColor?): RenameOutcome<GamePlatform>

    /** Deletes the platform unless a game still references it ([DeleteOutcome.IN_USE]). */
    suspend fun delete(id: GamePlatformId): DeleteOutcome
}

/**
 * Persistence port of the user-grown developer vocabulary (MT-025, ADR 0029). Implemented in
 * `games.persistence`; the domain never imports that package, so dependencies point inward only.
 */
interface GameDeveloperRepository {
    /**
     * Fulltext prefix search on the name, ordered by score, then name, then id; a blank/`null` [term] lists
     * developers alphabetically instead. Capped at [limit].
     */
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameDeveloper>

    suspend fun findByIds(ids: Set<GameDeveloperId>): List<GameDeveloper>

    /** Every developer including those without games, with their game count; ordered by name, then id. Unpaged. */
    suspend fun findSummaries(): List<GameDeveloperSummary>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<GameDeveloper>

    /** Deletes the developer unless a game still references it ([DeleteOutcome.IN_USE]). */
    suspend fun delete(id: GameDeveloperId): DeleteOutcome

    /**
     * Renames the developer. [RenameOutcome.Taken] when another developer carries the name
     * (case/accent-insensitively); a spelling that only differs from the developer's own name that way is a plain
     * rename.
     */
    suspend fun rename(id: GameDeveloperId, name: VocabularyName): RenameOutcome<GameDeveloper>

    /**
     * Folds [sourceId] into [targetId] in one transaction: every game of the source becomes a game of the target
     * (once), then the source is deleted. [MergeOutcome.SourceNotFound] / [MergeOutcome.TargetNotFound] when that
     * entry does not exist.
     */
    suspend fun merge(sourceId: GameDeveloperId, targetId: GameDeveloperId): MergeOutcome<GameDeveloper>
}

/**
 * Persistence port of the user-grown series vocabulary. Implemented in `games.persistence`; the domain never
 * imports that package, so dependencies point inward only.
 */
interface GameSeriesRepository {
    /**
     * Fulltext prefix search on the name, ordered by score, then name, then id; a blank/`null` [term] lists
     * series alphabetically instead. Capped at [limit].
     */
    suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<GameSeries>

    suspend fun findByIds(ids: Set<GameSeriesId>): List<GameSeries>

    /** Every series including those without games, with its game count; ordered by name, then id. Unpaged. */
    suspend fun findSummaries(): List<GameSeriesSummary>

    /** Idempotent: a case-insensitive existing match is returned instead of inserting a duplicate. */
    suspend fun create(name: VocabularyName): VocabularyCreation<GameSeries>

    /** Deletes the series unless a game still references it ([DeleteOutcome.IN_USE]). */
    suspend fun delete(id: GameSeriesId): DeleteOutcome

    /**
     * Renames the series. [RenameOutcome.Taken] when another series carries the name (case/accent-insensitively);
     * a spelling that only differs from the series' own name that way is a plain rename.
     */
    suspend fun rename(id: GameSeriesId, name: VocabularyName): RenameOutcome<GameSeries>

    /**
     * Folds [sourceId] into [targetId] in one transaction: every game of the source becomes a game of the target
     * (once, keeping its position; a game in both keeps the target's position, or the source's when the target's
     * is null), then the source is deleted. [MergeOutcome.SourceNotFound] / [MergeOutcome.TargetNotFound] when
     * that entry does not exist.
     */
    suspend fun merge(sourceId: GameSeriesId, targetId: GameSeriesId): MergeOutcome<GameSeries>
}
