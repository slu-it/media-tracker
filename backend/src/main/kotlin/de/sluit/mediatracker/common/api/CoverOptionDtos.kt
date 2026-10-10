package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.CoverOption
import de.sluit.mediatracker.common.domain.Page
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** One selectable cover image, in both a thumbnail and its full-size form. Sizes are `null` when unknown. */
@Serializable
data class CoverOptionResponse(val thumbnailUrl: String, val imageUrl: String, val width: Int?, val height: Int?)

fun CoverOption.toResponse() = CoverOptionResponse(
    thumbnailUrl = thumbnailUrl.value,
    imageUrl = imageUrl.value,
    width = width,
    height = height,
)

fun Page<CoverOption>.toCoverResponse(): PageResponse<CoverOptionResponse> = toResponse { it.toResponse() }
