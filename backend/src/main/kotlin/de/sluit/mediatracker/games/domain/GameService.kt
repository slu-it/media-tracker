package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.InvalidValueException
import de.sluit.mediatracker.common.NotFoundException
import de.sluit.mediatracker.common.Page
import de.sluit.mediatracker.common.PageRequest

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

    suspend fun list(request: PageRequest): Page<Game> = games.findPage(request)

    suspend fun listPlatforms(): List<GamePlatform> = platforms.findAll()

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
