package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.PatchField
import de.sluit.mediatracker.common.api.PatchFieldSerializer
import de.sluit.mediatracker.common.api.toPatch
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.releaseYearFromYearOrDate
import de.sluit.mediatracker.games.domain.DEFAULT_HIDDEN
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GameDeveloper
import de.sluit.mediatracker.games.domain.GameDeveloperId
import de.sluit.mediatracker.games.domain.GameDeveloperSummary
import de.sluit.mediatracker.games.domain.GameMeta
import de.sluit.mediatracker.games.domain.GamePatch
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.NewGame
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/**
 * POST /api/games. [releaseYear] is required unless [releaseDate] is given, in which case the date's year is
 * used instead (and overrides a [releaseYear] that contradicts it); see [toNewGame].
 */
@Serializable
data class CreateGameRequest(
    val title: String,
    val releaseYear: Int? = null,
    val platformIds: List<String>,
    val description: String? = null,
    val rating: Double? = null,
    val coverImageUrl: String? = null,
    val ownership: String? = null,
    val progress: String? = null,
    val hidden: Boolean? = null,
    val releaseDate: String? = null,
    val developerIds: List<String> = emptyList(),
)

/**
 * PATCH /api/games/{id}: every field optional; `coverImageUrl`/`description`/`rating`/`releaseDate: null`
 * clears the field. `platformIds`, when present, replaces the full set and must not be empty; `developerIds`,
 * when present, replaces the full set and may be empty. `ownership`, `progress` and `hidden` cannot be cleared,
 * so they are plain nullable fields rather than `PatchField`.
 */
@Serializable
data class UpdateGameRequest(
    val title: String? = null,
    val releaseYear: Int? = null,
    val platformIds: List<String>? = null,
    @Serializable(with = PatchFieldSerializer::class)
    val description: PatchField<String> = PatchField.Absent,
    @Serializable(with = PatchFieldSerializer::class)
    val rating: PatchField<Double> = PatchField.Absent,
    @Serializable(with = PatchFieldSerializer::class)
    val coverImageUrl: PatchField<String> = PatchField.Absent,
    val ownership: String? = null,
    val progress: String? = null,
    val hidden: Boolean? = null,
    @Serializable(with = PatchFieldSerializer::class)
    val releaseDate: PatchField<String> = PatchField.Absent,
    val developerIds: List<String>? = null,
)

@Serializable
data class GamePlatformResponse(val id: String, val label: String, val associatedColor: String)

@Serializable
data class GameDeveloperResponse(val id: String, val name: String)

/** GET /api/game-developers.summaries: a developer with the number of games linked to it (0 allowed). */
@Serializable
data class GameDeveloperSummaryResponse(val id: String, val name: String, val gameCount: Int)

/** POST /game-developers */
@Serializable
data class CreateGameDeveloperRequest(val name: String)

@Serializable
data class GameResponse(
    val id: String,
    val title: String,
    val releaseYear: Int,
    val platforms: List<GamePlatformResponse>,
    val description: String?,
    val rating: Double?,
    val coverImageUrl: String?,
    val ownership: String,
    val progress: String,
    val hidden: Boolean,
    val releaseDate: String?,
    val developers: List<GameDeveloperResponse>,
)

/** GET /api/games.meta: the filter values that actually occur in the stored games, pre-ordered by the domain. */
@Serializable
data class GameMetaResponse(
    val platforms: List<GamePlatformResponse>,
    val ownership: List<String>,
    val progress: List<String>,
    val releaseYears: List<Int>,
    /** platform id -> number of games using it; only used platforms appear. */
    val platformCounts: Map<String, Int>,
)

// DTO <-> domain conversions. Constructing the value objects is the validation; failures surface as 400.

fun CreateGameRequest.toNewGame(): NewGame {
    val parsedReleaseDate = releaseDate?.let(ReleaseDate::parse)
    val year = releaseYearFromYearOrDate(releaseYear, parsedReleaseDate)
    return NewGame(
        title = Title(title),
        releaseYear = year,
        platformIds = platformIds.map(GamePlatformId::parse).toSet(),
        description = description?.let(::Description),
        rating = rating?.let(::Rating),
        coverImageUrl = coverImageUrl?.let(::CoverImageUrl),
        ownership = ownership?.let(Ownership::from) ?: Ownership.DEFAULT,
        progress = progress?.let(Progress::from) ?: Progress.DEFAULT,
        hidden = hidden ?: DEFAULT_HIDDEN,
        releaseDate = parsedReleaseDate,
        developerIds = developerIds.map(GameDeveloperId::parse).toSet(),
    )
}

fun UpdateGameRequest.toPatch() = GamePatch(
    title = title?.let(::Title),
    releaseYear = releaseYear?.let(::ReleaseYear),
    platformIds = platformIds?.map(GamePlatformId::parse)?.toSet(),
    description = description.toPatch(::Description),
    rating = rating.toPatch(::Rating),
    coverImageUrl = coverImageUrl.toPatch(::CoverImageUrl),
    ownership = ownership?.let(Ownership::from),
    progress = progress?.let(Progress::from),
    hidden = hidden,
    releaseDate = releaseDate.toPatch(ReleaseDate::parse),
    developerIds = developerIds?.map(GameDeveloperId::parse)?.toSet(),
)

fun GamePlatform.toResponse() =
    GamePlatformResponse(id = id.toString(), label = label.value, associatedColor = color.value)

fun GameDeveloper.toResponse() = GameDeveloperResponse(id = id.toString(), name = name.value)

fun GameDeveloperSummary.toResponse() =
    GameDeveloperSummaryResponse(id = developer.id.toString(), name = developer.name.value, gameCount = gameCount)

fun Game.toResponse() = GameResponse(
    id = id.toString(),
    title = title.value,
    releaseYear = releaseYear.value,
    platforms = platforms.map { it.toResponse() },
    description = description?.value,
    rating = rating?.value,
    coverImageUrl = coverImageUrl?.value,
    ownership = ownership.wire,
    progress = progress.wire,
    hidden = hidden,
    releaseDate = releaseDate?.value?.toString(),
    developers = developers.map { it.toResponse() },
)

fun GameMeta.toResponse() = GameMetaResponse(
    platforms = platforms.map { it.toResponse() },
    ownership = ownership.map { it.wire },
    progress = progress.map { it.wire },
    releaseYears = releaseYears.map { it.value },
    platformCounts = platformCounts.mapKeys { it.key.toString() },
)
