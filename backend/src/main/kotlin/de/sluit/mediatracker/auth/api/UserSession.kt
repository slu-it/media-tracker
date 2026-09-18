package de.sluit.mediatracker.auth.api

import kotlinx.serialization.Serializable

/**
 * The authenticated principal. Ktor serializes this into the server-side session store
 * ([DbSessionStorage]); the browser only ever sees the random session id.
 */
@Serializable
data class UserSession(val userId: Long, val username: String)
