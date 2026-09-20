package de.sluit.mediatracker.games

import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.HexColor
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.Title
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

/** Builds a valid [Game] for tests, defaulting to a single platform (PC). */
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
): Game = Game(
    id = id,
    title = Title(title),
    releaseYear = ReleaseYear(releaseYear),
    platforms = platforms.sortedForGame(),
    description = description,
    rating = rating,
    coverImageUrl = coverImageUrl,
    ownership = ownership,
    progress = progress,
    hidden = hidden,
)
