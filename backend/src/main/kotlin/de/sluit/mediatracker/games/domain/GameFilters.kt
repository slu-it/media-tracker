package de.sluit.mediatracker.games.domain

/**
 * Narrows a game listing: empty per-category sets mean "no filter on that category", non-empty sets OR their
 * values, and the categories AND together. [isEmpty] decides whether [GameService.list] takes the filtered
 * ([GameRepository.search]) or the plain ([GameRepository.findPage]) branch.
 */
data class GameFilters(
    val platformIds: Set<GamePlatformId> = emptySet(),
    val ownership: Set<Ownership> = emptySet(),
    val progress: Set<Progress> = emptySet(),
    val releaseYears: Set<ReleaseYear> = emptySet(),
) {
    val isEmpty: Boolean
        get() = platformIds.isEmpty() && ownership.isEmpty() && progress.isEmpty() && releaseYears.isEmpty()

    companion object {
        val NONE = GameFilters()
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
