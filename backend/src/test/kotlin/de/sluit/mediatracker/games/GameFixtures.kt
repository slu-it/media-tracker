package de.sluit.mediatracker.games

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameDeveloper
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.sortedByNameForGame
import de.sluit.mediatracker.games.domain.sortedForGame
import kotlin.uuid.Uuid

/** The four platforms seeded by db/migration/V002__games.sql, as domain objects, for use in fixtures. */
object Platforms {
    val PC = GamePlatform(
        GamePlatformId(Uuid.parseHexDash(SeededPlatforms.PC)),
        PlatformLabel("PC"),
        HexColor("757575"),
    )
    val PLAYSTATION = GamePlatform(
        GamePlatformId(Uuid.parseHexDash(SeededPlatforms.PLAYSTATION)),
        PlatformLabel("PlayStation"),
        HexColor("0070D1"),
    )
    val XBOX = GamePlatform(
        GamePlatformId(Uuid.parseHexDash(SeededPlatforms.XBOX)),
        PlatformLabel("Xbox"),
        HexColor("107C10"),
    )
    val NINTENDO = GamePlatform(
        GamePlatformId(Uuid.parseHexDash(SeededPlatforms.NINTENDO)),
        PlatformLabel("Nintendo"),
        HexColor("E60012"),
    )
}

/** Builds a valid [GameDeveloper] for tests, with a random id unless one is given. */
fun developer(name: String, id: GameDeveloperId = GameDeveloperId.new()): GameDeveloper =
    GameDeveloper(id, VocabularyName(name))

/**
 * Builds a valid [Game] for tests, defaulting to a single platform (PC). When [releaseDate] is given, it
 * decides the year (like production: [releaseYear] is ignored then), so callers only need one of the two.
 */
fun game(
    title: String,
    platforms: List<GamePlatform> = listOf(Platforms.PC),
    id: GameId = GameId.new(),
    releaseYear: Int = 2018,
    description: Description? = null,
    rating: Rating? = null,
    coverImageUrl: CoverImageUrl? = null,
    ownership: Ownership = Ownership.DEFAULT,
    progress: Progress = Progress.DEFAULT,
    hidden: Boolean = false,
    releaseDate: ReleaseDate? = null,
    developers: List<GameDeveloper> = emptyList(),
): Game = Game(
    id = id,
    title = Title(title),
    releaseYear = releaseDate?.let { ReleaseYear(it.year) } ?: ReleaseYear(releaseYear),
    platforms = platforms.sortedForGame(),
    description = description,
    rating = rating,
    coverImageUrl = coverImageUrl,
    ownership = ownership,
    progress = progress,
    hidden = hidden,
    releaseDate = releaseDate,
    developers = developers.sortedByNameForGame(),
)
