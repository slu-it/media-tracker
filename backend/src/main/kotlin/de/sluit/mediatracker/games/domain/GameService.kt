package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.SeriesPosition

/**
 * Business use cases for games. Deliberately thin while the feature is plain CRUD; decisions that do not
 * belong to HTTP or SQL (id assignment, existence checks, applying a patch, resolving platform ids) live
 * here and nowhere else.
 */
class GameService(
    private val games: GameRepository,
    private val platforms: GamePlatformRepository,
    private val developers: GameDeveloperRepository,
    private val series: GameSeriesRepository,
) {
    suspend fun create(newGame: NewGame): Game {
        val game = Game(
            id = GameId.new(),
            title = newGame.title,
            releaseYear = newGame.effectiveReleaseYear,
            platforms = resolvePlatforms(newGame.platformIds),
            description = newGame.description,
            rating = newGame.rating,
            coverImageUrl = newGame.coverImageUrl,
            ownership = newGame.ownership,
            progress = newGame.progress,
            hidden = newGame.hidden,
            releaseDate = newGame.releaseDate,
            developers = resolveDevelopers(newGame.developerIds),
            series = resolveSeries(newGame.series),
        )
        games.insert(game)
        return game
    }

    /** Load, apply, save. Two transactions; acceptable for a single-user application. */
    suspend fun update(id: GameId, patch: GamePatch): Game {
        val current = games.findById(id) ?: throw NotFoundException(RESOURCE, id.toString())
        val resolvedPlatforms = patch.platformIds?.let { resolvePlatforms(it) } ?: current.platforms
        val resolvedDevelopers = patch.developerIds?.let { resolveDevelopers(it) } ?: current.developers
        val resolvedSeries = patch.series?.let { resolveSeries(it) } ?: current.series
        val updated = patch.applyTo(current, resolvedPlatforms, resolvedDevelopers, resolvedSeries)
        if (!games.update(updated)) throw NotFoundException(RESOURCE, id.toString())
        return updated
    }

    /** Idempotent: deleting an unknown id is not an error. */
    suspend fun delete(id: GameId) {
        games.deleteById(id)
    }

    /**
     * Decides between the title-ordered page ([search] absent, [filters] empty and [sort] the default
     * [GameSort.TITLE]) and the filtered/search listing (any of the three present).
     */
    suspend fun list(
        request: PageRequest,
        search: SearchTerm?,
        filters: GameFilters,
        sort: GameSort = GameSort.TITLE,
    ): Page<Game> = if (search == null && filters.isEmpty && sort == GameSort.TITLE) {
        games.findPage(request)
    } else {
        games.search(search, filters, request, sort)
    }

    /** The games of one developer in release order; an unknown [developerId] is not found, one without games an empty list. */
    suspend fun listByDeveloper(developerId: GameDeveloperId): List<Game> {
        if (developers.findByIds(setOf(developerId)).isEmpty()) {
            throw NotFoundException(DEVELOPER_RESOURCE, developerId.toString())
        }
        return games.findByDeveloper(developerId)
    }

    /** The games of one series in series order; an unknown [seriesId] is not found, an empty series is an empty list. */
    suspend fun listBySeries(seriesId: GameSeriesId): List<Game> {
        if (series.findByIds(setOf(seriesId)).isEmpty()) throw NotFoundException(SERIES_RESOURCE, seriesId.toString())
        return games.findBySeries(seriesId)
    }

    suspend fun listPlatforms(): List<GamePlatform> = platforms.findAll()

    /** The filter values that actually occur in the stored games, ordered for display. */
    suspend fun meta(): GameMeta {
        val used = games.findUsedFilterValues()
        return GameMeta(
            platforms = platforms.findAll().filter { it.id in used.platformCounts.keys },
            ownership = Ownership.entries.filter { it in used.ownership },
            progress = Progress.entries.filter { it in used.progress },
            releaseYears = used.releaseYears.sortedByDescending { it.value },
            platformCounts = used.platformCounts,
        )
    }

    private suspend fun resolvePlatforms(ids: Set<GamePlatformId>): List<GamePlatform> {
        val found = platforms.findByIds(ids)
        val foundIds = found.map { it.id }.toSet()
        val missing = ids - foundIds
        if (missing.isNotEmpty()) {
            throw InvalidValueException(GamePlatformId.FIELD, "unknown platform id ${missing.first()}")
        }
        return found.sortedForGame()
    }

    private suspend fun resolveDevelopers(ids: Set<GameDeveloperId>): List<GameDeveloper> {
        if (ids.isEmpty()) return emptyList()
        val found = developers.findByIds(ids)
        val foundIds = found.map { it.id }.toSet()
        val missing = ids - foundIds
        if (missing.isNotEmpty()) {
            throw InvalidValueException(GameDeveloperId.FIELD, "unknown developer id ${missing.first()}")
        }
        return found.sortedByNameForGame()
    }

    private suspend fun resolveSeries(positions: Map<GameSeriesId, SeriesPosition?>): List<GameSeriesEntry> {
        if (positions.isEmpty()) return emptyList()
        val found = series.findByIds(positions.keys)
        val missing = positions.keys - found.map { it.id }.toSet()
        if (missing.isNotEmpty()) {
            throw InvalidValueException(GameSeriesId.FIELD, "unknown series id ${missing.first()}")
        }
        return found.map { GameSeriesEntry(it, positions[it.id]) }.sortedByNameForGame()
    }

    companion object {
        const val RESOURCE = "game"
        const val DEVELOPER_RESOURCE = "game developer"
        const val SERIES_RESOURCE = "game series"
    }
}
