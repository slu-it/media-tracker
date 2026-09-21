package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.Page
import de.sluit.mediatracker.common.domain.PageRequest
import de.sluit.mediatracker.common.domain.SearchTerm

/**
 * Business use cases for games. Deliberately thin while the feature is plain CRUD; decisions that do not
 * belong to HTTP or SQL (id assignment, existence checks, applying a patch, resolving platform ids) live
 * here and nowhere else.
 */
class GameService(private val games: GameRepository, private val platforms: GamePlatformRepository) {
    suspend fun create(newGame: NewGame): Game {
        val game = Game(
            id = GameId.new(),
            title = newGame.title,
            releaseYear = newGame.releaseYear,
            platforms = resolvePlatforms(newGame.platformIds),
            description = newGame.description,
            rating = newGame.rating,
            coverImageUrl = newGame.coverImageUrl,
            ownership = newGame.ownership,
            progress = newGame.progress,
            hidden = newGame.hidden,
        )
        games.insert(game)
        return game
    }

    /** Load, apply, save. Two transactions; acceptable for a single-user application. */
    suspend fun update(id: GameId, patch: GamePatch): Game {
        val current = games.findById(id) ?: throw NotFoundException(RESOURCE, id.toString())
        val resolvedPlatforms = patch.platformIds?.let { resolvePlatforms(it) } ?: current.platforms
        val updated = patch.applyTo(current, resolvedPlatforms)
        if (!games.update(updated)) throw NotFoundException(RESOURCE, id.toString())
        return updated
    }

    /** Idempotent: deleting an unknown id is not an error. */
    suspend fun delete(id: GameId) {
        games.deleteById(id)
    }

    /**
     * Decides between the title-ordered page ([search] absent and [filters] empty) and the filtered/search
     * listing (either one present).
     */
    suspend fun list(request: PageRequest, search: SearchTerm?, filters: GameFilters): Page<Game> =
        if (search == null && filters.isEmpty) games.findPage(request) else games.search(search, filters, request)

    suspend fun listPlatforms(): List<GamePlatform> = platforms.findAll()

    /** The filter values that actually occur in the stored games, ordered for display. */
    suspend fun meta(): GameMeta {
        val used = games.findUsedFilterValues()
        return GameMeta(
            platforms = platforms.findAll().filter { it.id in used.platformIds },
            ownership = Ownership.entries.filter { it in used.ownership },
            progress = Progress.entries.filter { it in used.progress },
            releaseYears = used.releaseYears.sortedBy { it.value },
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

    companion object {
        const val RESOURCE = "game"
    }
}
