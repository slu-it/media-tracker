package de.sluit.mediatracker.games.api

import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionPatch
import de.sluit.mediatracker.games.domain.NewExpansion
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.domain.Title
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** POST /api/games/{gameId}/expansions */
@Serializable
data class CreateExpansionRequest(val title: String, val ownership: String? = null, val progress: String? = null)

/**
 * PATCH /api/games/{gameId}/expansions/{expansionId}: every field optional and, unlike a game's optional fields,
 * `null` never clears a field - no expansion field can be cleared - it simply means "unchanged". A non-null
 * [sequence] is a move request, interpreted by [de.sluit.mediatracker.games.domain.ExpansionService.update].
 */
@Serializable
data class UpdateExpansionRequest(
    val title: String? = null,
    val ownership: String? = null,
    val progress: String? = null,
    val sequence: Int? = null,
)

@Serializable
data class ExpansionResponse(
    val id: String,
    val gameId: String,
    val sequence: Int,
    val title: String,
    val ownership: String,
    val progress: String,
)

// DTO <-> domain conversions. Constructing the value objects is the validation; failures surface as 400.

fun CreateExpansionRequest.toNewExpansion() = NewExpansion(
    title = Title(title),
    ownership = ownership?.let(Ownership::from) ?: Ownership.DEFAULT,
    progress = progress?.let(Progress::from) ?: Progress.DEFAULT,
)

fun UpdateExpansionRequest.toPatch() = ExpansionPatch(
    title = title?.let(::Title),
    ownership = ownership?.let(Ownership::from),
    progress = progress?.let(Progress::from),
    sequence = sequence?.let(::SequenceNumber),
)

fun Expansion.toResponse() = ExpansionResponse(
    id = id.toString(),
    gameId = gameId.toString(),
    sequence = sequence.value,
    title = title.value,
    ownership = ownership.wire,
    progress = progress.wire,
)
