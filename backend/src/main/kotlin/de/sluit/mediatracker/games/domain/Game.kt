package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.Patch
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.applyTo
import de.sluit.mediatracker.common.domain.effectiveReleaseYear
import de.sluit.mediatracker.common.domain.requireReleaseYearMatches
import de.sluit.mediatracker.common.domain.requireValid
import de.sluit.mediatracker.common.domain.resolvePatchedReleaseYear

/** A selectable platform a game can be played on; the four rows are seeded by the games migration. */
data class GamePlatform(val id: GamePlatformId, val label: PlatformLabel, val color: HexColor)

/** Sorts by label case-insensitively, then id, so the order is deterministic and duplicate-free. */
fun List<GamePlatform>.sortedForGame(): List<GamePlatform> = distinctBy { it.id }
    .sortedWith(compareBy({ it.label.value.lowercase() }, { it.id.toString() }))

/** A developer the user has added to the vocabulary (MT-025, ADR 0029); grown on the fly, unlike [GamePlatform]. */
data class GameDeveloper(val id: GameDeveloperId, val name: VocabularyName)

/**
 * Sorts by name case-insensitively, then id, so the order is deterministic and duplicate-free. Named
 * differently from [GamePlatform]'s `sortedForGame` (identical after generic erasure) to avoid a JVM signature
 * clash between the two extension functions.
 */
fun List<GameDeveloper>.sortedByNameForGame(): List<GameDeveloper> = distinctBy { it.id }
    .sortedWith(compareBy({ it.name.value.lowercase() }, { it.id.toString() }))

/** A developer with the number of games linked to it (0 for a developer nobody references yet). */
data class GameDeveloperSummary(val developer: GameDeveloper, val gameCount: Int)

/** A game as the business layer sees it. All fields are validated value objects. */
data class Game(
    val id: GameId,
    val title: Title,
    val releaseYear: ReleaseYear,
    val platforms: List<GamePlatform>,
    val description: Description? = null,
    val rating: Rating? = null,
    val coverImageUrl: CoverImageUrl? = null,
    val ownership: Ownership = Ownership.DEFAULT,
    val progress: Progress = Progress.DEFAULT,
    val hidden: Boolean = DEFAULT_HIDDEN,
    val releaseDate: ReleaseDate? = null,
    val developers: List<GameDeveloper> = emptyList(),
) {
    init {
        requireValid(GamePlatformId.FIELD, platforms.isNotEmpty()) { "must not be empty" }
        requireValid(GamePlatformId.FIELD, platforms.map { it.id }.distinct().size == platforms.size) {
            "must not contain duplicates"
        }
        requireValid(GamePlatformId.FIELD, platforms == platforms.sortedForGame()) {
            "must be sorted by label"
        }
        requireValid(GameDeveloperId.FIELD, developers.map { it.id }.distinct().size == developers.size) {
            "must not contain duplicates"
        }
        requireValid(GameDeveloperId.FIELD, developers == developers.sortedByNameForGame()) {
            "must be sorted by name"
        }
        requireReleaseYearMatches(releaseYear, releaseDate)
    }
}

/**
 * Everything needed to create a game; the id is assigned by [GameService]. [releaseYear] is the year as
 * requested; when [releaseDate] is also given, [effectiveReleaseYear] (what [GameService.create] actually
 * stores) derives the year from the date instead, overriding a contradicting [releaseYear].
 */
data class NewGame(
    val title: Title,
    val releaseYear: ReleaseYear,
    val platformIds: Set<GamePlatformId>,
    val description: Description? = null,
    val rating: Rating? = null,
    val coverImageUrl: CoverImageUrl? = null,
    val ownership: Ownership = Ownership.DEFAULT,
    val progress: Progress = Progress.DEFAULT,
    val hidden: Boolean = DEFAULT_HIDDEN,
    val releaseDate: ReleaseDate? = null,
    val developerIds: Set<GameDeveloperId> = emptySet(),
) {
    init {
        requireValid(GamePlatformId.FIELD, platformIds.isNotEmpty()) { "must not be empty" }
    }

    val effectiveReleaseYear: ReleaseYear get() = effectiveReleaseYear(releaseYear, releaseDate)
}

/**
 * Partial update. Required fields use `null` for "leave unchanged" (they can never be cleared); the optional
 * fields use [Patch] so that "unchanged" and "clear" stay distinguishable. `platformIds` is `null` for
 * "unchanged" too, but can never be cleared to empty (a game always needs at least one platform). `developerIds`
 * is `null` for "unchanged" too, but unlike `platformIds` it can be cleared to an empty set (a game may have no
 * known developers). `releaseDate` wins over `releaseYear` whenever both would otherwise apply, see [applyTo].
 */
data class GamePatch(
    val title: Title? = null,
    val releaseYear: ReleaseYear? = null,
    val platformIds: Set<GamePlatformId>? = null,
    val description: Patch<Description> = Patch.Unchanged,
    val rating: Patch<Rating> = Patch.Unchanged,
    val coverImageUrl: Patch<CoverImageUrl> = Patch.Unchanged,
    val ownership: Ownership? = null,
    val progress: Progress? = null,
    val hidden: Boolean? = null,
    val releaseDate: Patch<ReleaseDate> = Patch.Unchanged,
    val developerIds: Set<GameDeveloperId>? = null,
) {
    init {
        if (platformIds != null) {
            requireValid(GamePlatformId.FIELD, platformIds.isNotEmpty()) { "must not be empty" }
        }
    }

    /**
     * [platforms] and [developers] must already be the resolved, sorted replacements when [platformIds] /
     * [developerIds] are non-null. The resolved release date decides the year: a date present after this patch
     * (whether just set or already there and left unchanged) always wins, overriding a contradicting
     * [releaseYear]; only when no date is present (never set, or just cleared) does a given [releaseYear] apply,
     * else the game's current year is kept.
     */
    fun applyTo(game: Game, platforms: List<GamePlatform>, developers: List<GameDeveloper>): Game {
        val resolvedReleaseDate = releaseDate.applyTo(game.releaseDate)
        val resolvedReleaseYear = resolvePatchedReleaseYear(releaseYear, resolvedReleaseDate, game.releaseYear)
        return game.copy(
            title = title ?: game.title,
            releaseYear = resolvedReleaseYear,
            platforms = if (platformIds != null) platforms else game.platforms,
            description = description.applyTo(game.description),
            rating = rating.applyTo(game.rating),
            coverImageUrl = coverImageUrl.applyTo(game.coverImageUrl),
            ownership = ownership ?: game.ownership,
            progress = progress ?: game.progress,
            hidden = hidden ?: game.hidden,
            releaseDate = resolvedReleaseDate,
            developers = if (developerIds != null) developers else game.developers,
        )
    }
}
