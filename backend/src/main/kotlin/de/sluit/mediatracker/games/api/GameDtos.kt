package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.PatchField
import de.sluit.mediatracker.common.api.PatchFieldSerializer
import de.sluit.mediatracker.common.api.toPatch
import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SeriesPosition
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
import de.sluit.mediatracker.games.domain.GamePlatformSummary
import de.sluit.mediatracker.games.domain.GameSeries
import de.sluit.mediatracker.games.domain.GameSeriesEntry
import de.sluit.mediatracker.games.domain.GameSeriesId
import de.sluit.mediatracker.games.domain.GameSeriesSummary
import de.sluit.mediatracker.games.domain.NewGame
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.PlatformLabel
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
    val series: List<GameSeriesLinkRequest> = emptyList(),
)

/**
 * PATCH /api/games/{id}: every field optional; `coverImageUrl`/`description`/`rating`/`releaseDate: null`
 * clears the field. `platformIds`, when present, replaces the full set and must not be empty; `developerIds`,
 * when present, replaces the full set and may be empty, as does `series`. `ownership`, `progress` and `hidden` cannot be cleared,
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
    val series: List<GameSeriesLinkRequest>? = null,
)

@Serializable
data class GamePlatformResponse(val id: String, val label: String, val associatedColor: String)

/** POST /api/game-platforms: [associatedColor] is six hex digits without '#'; stored uppercase. */
@Serializable
data class CreateGamePlatformRequest(val label: String, val associatedColor: String)

/** PATCH /api/game-platforms/{id}: at least one field; an absent (or null) field keeps the stored value. */
@Serializable
data class UpdateGamePlatformRequest(val label: String? = null, val associatedColor: String? = null)

/** GET /api/game-platforms.summaries: a platform with the number of games using it (0 allowed). */
@Serializable
data class GamePlatformSummaryResponse(
    val id: String,
    val label: String,
    val associatedColor: String,
    val gameCount: Int,
)

/** One game-to-series link in a request: the series and the game's optional number in it (e.g. 1 or 2.5). */
@Serializable
data class GameSeriesLinkRequest(val seriesId: String, val position: Double? = null)

@Serializable
data class GameDeveloperResponse(val id: String, val name: String)

/** GET /api/game-developers.summaries: a developer with the number of games linked to it (0 allowed). */
@Serializable
data class GameDeveloperSummaryResponse(val id: String, val name: String, val gameCount: Int)

/** POST /game-developers */
@Serializable
data class CreateGameDeveloperRequest(val name: String)

@Serializable
data class GameSeriesResponse(val id: String, val name: String)

/** GET /api/game-series.summaries: a series with the number of games linked to it (0 allowed). */
@Serializable
data class GameSeriesSummaryResponse(val id: String, val name: String, val gameCount: Int)

/** POST /game-series */
@Serializable
data class CreateGameSeriesRequest(val name: String)

/** A series of a game with the game's [position] in it, `null` when it has no number. */
@Serializable
data class GameSeriesEntryResponse(val id: String, val name: String, val position: Double?)

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
    val series: List<GameSeriesEntryResponse>,
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
        series = series.toPositions(),
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
    series = series?.toPositions(),
)

/** A series may be linked once per game; a repeated id is a client error, not something to merge silently. */
private fun List<GameSeriesLinkRequest>.toPositions(): Map<GameSeriesId, SeriesPosition?> {
    val positions = LinkedHashMap<GameSeriesId, SeriesPosition?>()
    forEach { link ->
        val id = GameSeriesId.parse(link.seriesId)
        val position = link.position?.let(SeriesPosition::fromDouble)
        if (positions.containsKey(id)) throw InvalidValueException(GameSeriesId.FIELD, "must not contain duplicates")
        positions[id] = position
    }
    return positions
}

fun GamePlatform.toResponse() =
    GamePlatformResponse(id = id.toString(), label = label.value, associatedColor = color.value)

fun GamePlatformSummary.toResponse() = GamePlatformSummaryResponse(
    id = platform.id.toString(),
    label = platform.label.value,
    associatedColor = platform.color.value,
    gameCount = gameCount,
)

/** The label and colour of a new platform; the label is trimmed, the colour uppercased. */
fun CreateGamePlatformRequest.toLabelAndColor(): Pair<PlatformLabel, HexColor> =
    PlatformLabel.parse(label) to HexColor.parse(associatedColor)

/** The fields to change (`null`: keep); a request that changes nothing is a [InvalidValueException]. */
fun UpdateGamePlatformRequest.toLabelAndColor(): Pair<PlatformLabel?, HexColor?> {
    if (label == null && associatedColor == null) {
        throw InvalidValueException(PlatformLabel.FIELD, "at least one of label, associatedColor is required")
    }
    return label?.let(PlatformLabel::parse) to associatedColor?.let(HexColor::parse)
}

fun GameDeveloper.toResponse() = GameDeveloperResponse(id = id.toString(), name = name.value)

fun GameDeveloperSummary.toResponse() =
    GameDeveloperSummaryResponse(id = developer.id.toString(), name = developer.name.value, gameCount = gameCount)

fun GameSeries.toResponse() = GameSeriesResponse(id = id.toString(), name = name.value)

fun GameSeriesSummary.toResponse() =
    GameSeriesSummaryResponse(id = series.id.toString(), name = series.name.value, gameCount = gameCount)

fun GameSeriesEntry.toResponse() =
    GameSeriesEntryResponse(id = series.id.toString(), name = series.name.value, position = position?.value?.toDouble())

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
    series = series.map { it.toResponse() },
)

fun GameMeta.toResponse() = GameMetaResponse(
    platforms = platforms.map { it.toResponse() },
    ownership = ownership.map { it.wire },
    progress = progress.map { it.wire },
    releaseYears = releaseYears.map { it.value },
    platformCounts = platformCounts.mapKeys { it.key.toString() },
)
