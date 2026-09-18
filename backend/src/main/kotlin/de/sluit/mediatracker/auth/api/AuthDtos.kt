// Named after the feature's DTO file convention (e.g. games/api/GameDtos.kt), not the single type it
// currently holds; ktlint's filename rule would otherwise demand `MeResponse.kt`.
@file:Suppress("ktlint:standard:filename")

package de.sluit.mediatracker.auth.api

import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** GET /api/me */
@Serializable
data class MeResponse(val username: String)
