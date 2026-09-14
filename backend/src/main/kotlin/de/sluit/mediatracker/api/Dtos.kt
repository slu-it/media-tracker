package de.sluit.mediatracker.api

import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

@Serializable
data class MeResponse(val username: String)

@Serializable
data class ErrorResponse(val error: String)

@Serializable
data class HealthResponse(val status: String = "ok")
