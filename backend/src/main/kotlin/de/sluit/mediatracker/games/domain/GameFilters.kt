package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException

/**
 * Narrows a game listing: empty per-category sets mean "no filter on that category", non-empty sets OR their
 * values within their own category, and the categories AND together. [missing] is one such category: a game
 * matches it when ANY of the listed [MissingField]s is null on that game. [isEmpty] decides whether
 * [GameService.list] takes the filtered ([GameRepository.search]) or the plain ([GameRepository.findPage]) branch.
 */
data class GameFilters(
    val platformIds: Set<GamePlatformId> = emptySet(),
    val ownership: Set<Ownership> = emptySet(),
    val progress: Set<Progress> = emptySet(),
    val releaseYears: Set<ReleaseYear> = emptySet(),
    val missing: Set<MissingField> = emptySet(),
) {
    val isEmpty: Boolean
        get() = platformIds.isEmpty() && ownership.isEmpty() && progress.isEmpty() && releaseYears.isEmpty() &&
            missing.isEmpty()

    companion object {
        val NONE = GameFilters()
    }
}

/**
 * A game property that can be absent, as the `hasMissing` filter names it. Unlike the status enums of
 * ADR 0017 the wire value is the field's own name, not `name.lowercase()`: it is taken from the value class'
 * `FIELD` constant, which the DTOs in `games/api/GameDtos.kt` mirror, so an agent passes back exactly the
 * field it saw as `null` in a game.
 */
enum class MissingField(val wire: String) {
    DESCRIPTION(Description.FIELD),
    COVER_IMAGE_URL(CoverImageUrl.FIELD),
    ;

    companion object {
        const val FIELD = "hasMissing"

        fun from(wire: String): MissingField = entries.firstOrNull { it.wire == wire }
            ?: throw InvalidValueException(FIELD, "must be one of ${entries.joinToString { it.wire }}")
    }
}

/**
 * The filter values that actually occur in the stored games, in the order the frontend should offer them; see
 * [GameService.meta].
 */
data class GameMeta(
    val platforms: List<GamePlatform>,
    val ownership: List<Ownership>,
    val progress: List<Progress>,
    val releaseYears: List<ReleaseYear>,
)
