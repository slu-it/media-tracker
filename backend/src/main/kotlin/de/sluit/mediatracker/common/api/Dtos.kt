package de.sluit.mediatracker.common.api

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.Serializable

// Shared DTOs. Feature DTOs live in <feature>/api/*Dtos.kt (e.g. games/api/GameDtos.kt).
// All of them are mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/**
 * Error body of every non-2xx API response. [error] is a stable snake_case code (`validation_error`,
 * `invalid_body`, `not_found`, `unauthorized`, `name_taken`, `internal_error`); [message] is a human-readable
 * detail that is only present when there is something useful to say (it is omitted from the JSON, not sent as
 * null). `name_taken` additionally carries the entry that holds the name in [existingId] and [existingName];
 * both are omitted otherwise.
 */
@Serializable
data class ErrorResponse(
    val error: String,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val message: String? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val existingId: String? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val existingName: String? = null,
)

/** PATCH of a vocabulary entry (book author, book series): the new [name]. */
@Serializable
data class RenameVocabularyRequest(val name: String)

/** POST `/merge` of a vocabulary entry: the id of the entry the addressed one is folded into. */
@Serializable
data class MergeVocabularyRequest(val targetId: String)

@Serializable
data class HealthResponse(val status: String = "ok")

/** One page of a paginated list. `page` is 1-based; `totalPages` is 0 when the list is empty. */
@Serializable
data class PageResponse<T>(
    val items: List<T>,
    val page: Int,
    val pageSize: Int,
    val totalItems: Long,
    val totalPages: Int,
)
