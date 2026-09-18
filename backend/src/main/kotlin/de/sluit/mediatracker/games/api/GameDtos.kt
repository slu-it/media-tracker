package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.common.api.PatchField
import de.sluit.mediatracker.common.api.PatchFieldSerializer
import de.sluit.mediatracker.common.api.toPatch
import de.sluit.mediatracker.games.domain.CoverImageUrl
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.Game
import de.sluit.mediatracker.games.domain.GamePatch
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.NewGame
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.ReleaseYear
import de.sluit.mediatracker.games.domain.Title
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** POST /api/games */
@Serializable
data class CreateGameRequest(
    val title: String,
    val releaseYear: Int,
    val platformIds: List<String>,
    val description: String? = null,
    val rating: Double? = null,
    val coverImageUrl: String? = null,
)

/**
 * PATCH /api/games/{id}: every field optional; `coverImageUrl`/`description`/`rating: null` clears the
 * field. `platformIds`, when present, replaces the full set and must not be empty.
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
)

@Serializable
data class GamePlatformResponse(val id: String, val label: String, val associatedColor: String)

@Serializable
data class GameResponse(
    val id: String,
    val title: String,
    val releaseYear: Int,
    val platforms: List<GamePlatformResponse>,
    val description: String?,
    val rating: Double?,
    val coverImageUrl: String?,
)

// DTO <-> domain conversions. Constructing the value objects is the validation; failures surface as 400.

fun CreateGameRequest.toNewGame() = NewGame(
    title = Title(title),
    releaseYear = ReleaseYear(releaseYear),
    platformIds = platformIds.map(GamePlatformId::parse).toSet(),
    description = description?.let(::Description),
    rating = rating?.let(::Rating),
    coverImageUrl = coverImageUrl?.let(::CoverImageUrl),
)

fun UpdateGameRequest.toPatch() = GamePatch(
    title = title?.let(::Title),
    releaseYear = releaseYear?.let(::ReleaseYear),
    platformIds = platformIds?.map(GamePlatformId::parse)?.toSet(),
    description = description.toPatch(::Description),
    rating = rating.toPatch(::Rating),
    coverImageUrl = coverImageUrl.toPatch(::CoverImageUrl),
)

fun GamePlatform.toResponse() =
    GamePlatformResponse(id = id.toString(), label = label.value, associatedColor = color.value)

fun Game.toResponse() = GameResponse(
    id = id.toString(),
    title = title.value,
    releaseYear = releaseYear.value,
    platforms = platforms.map { it.toResponse() },
    description = description?.value,
    rating = rating?.value,
    coverImageUrl = coverImageUrl?.value,
)
