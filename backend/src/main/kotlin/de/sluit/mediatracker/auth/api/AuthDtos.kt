// Named after the feature's DTO file convention (e.g. games/api/GameDtos.kt), not the single type it
// currently holds; ktlint's filename rule would otherwise demand `MeResponse.kt`.
@file:Suppress("ktlint:standard:filename")

package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.ApiKeys
import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** GET /api/me */
@Serializable
data class MeResponse(val username: String)

/** GET/POST /api/me/api-keys; either slot may be absent (null) if never regenerated. */
@Serializable
data class ApiKeysResponse(val primary: String?, val secondary: String?)

fun ApiKeys.toResponse() = ApiKeysResponse(primary = primary?.toString(), secondary = secondary?.toString())
