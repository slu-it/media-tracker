package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.applyTo
import de.sluit.mediatracker.common.domain.requireValid

/** A selectable platform a game can be played on; the four rows are seeded by the games migration. */
data class GamePlatform(val id: GamePlatformId, val label: PlatformLabel, val color: HexColor)

/** Sorts by label case-insensitively, then id, so the order is deterministic and duplicate-free. */
fun List<GamePlatform>.sortedForGame(): List<GamePlatform> = distinctBy { it.id }
    .sortedWith(compareBy({ it.label.value.lowercase() }, { it.id.toString() }))

/** A game as the business layer sees it. All fields are validated value objects. */
data class Game(
    val id: GameId,
    val title: Title,
    val releaseYear: ReleaseYear,
    val platforms: List<GamePlatform>,
    val description: Description? = null,
    val rating: Rating? = null,
    val coverImageUrl: CoverImageUrl? = null,
) {
    init {
        requireValid(GamePlatformId.FIELD, platforms.isNotEmpty()) { "must not be empty" }
        requireValid(GamePlatformId.FIELD, platforms.map { it.id }.distinct().size == platforms.size) {
            "must not contain duplicates"
        }
        requireValid(GamePlatformId.FIELD, platforms == platforms.sortedForGame()) {
            "must be sorted by label"
        }
    }
}

/** Everything needed to create a game; the id is assigned by [GameService]. */
data class NewGame(
    val title: Title,
    val releaseYear: ReleaseYear,
    val platformIds: Set<GamePlatformId>,
    val description: Description? = null,
    val rating: Rating? = null,
    val coverImageUrl: CoverImageUrl? = null,
) {
    init {
        requireValid(GamePlatformId.FIELD, platformIds.isNotEmpty()) { "must not be empty" }
    }
}

/**
 * Partial update. Required fields use `null` for "leave unchanged" (they can never be cleared); the optional
 * fields use [Patch] so that "unchanged" and "clear" stay distinguishable. `platformIds` is `null` for
 * "unchanged" too, but can never be cleared to empty (a game always needs at least one platform).
 */
data class GamePatch(
    val title: Title? = null,
    val releaseYear: ReleaseYear? = null,
    val platformIds: Set<GamePlatformId>? = null,
    val description: Patch<Description> = Patch.Unchanged,
    val rating: Patch<Rating> = Patch.Unchanged,
    val coverImageUrl: Patch<CoverImageUrl> = Patch.Unchanged,
) {
    init {
        if (platformIds != null) {
            requireValid(GamePlatformId.FIELD, platformIds.isNotEmpty()) { "must not be empty" }
        }
    }

    /** [platforms] must already be the resolved, sorted replacement when [platformIds] is non-null. */
    fun applyTo(game: Game, platforms: List<GamePlatform>): Game = game.copy(
        title = title ?: game.title,
        releaseYear = releaseYear ?: game.releaseYear,
        platforms = if (platformIds != null) platforms else game.platforms,
        description = description.applyTo(game.description),
        rating = rating.applyTo(game.rating),
        coverImageUrl = coverImageUrl.applyTo(game.coverImageUrl),
    )
}
