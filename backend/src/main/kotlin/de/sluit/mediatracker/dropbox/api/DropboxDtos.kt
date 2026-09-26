package de.sluit.mediatracker.dropbox.api

import kotlinx.serialization.Serializable

// Mirrored by hand in frontend/src/types/api.ts. Keep both in sync.

/** GET /api/dropbox: whether the app key/secret are configured, whether a connection exists, and since when. */
@Serializable
data class DropboxStatusResponse(val available: Boolean, val connected: Boolean, val connectedAt: String?)

/** GET /api/dropbox/authorize-url: opened in a new tab to start the in-app, no-redirect code flow. */
@Serializable
data class AuthorizeUrlResponse(val url: String)

/** POST /api/dropbox/connection: the code the user pasted from Dropbox's authorization page. */
@Serializable
data class ConnectDropboxRequest(val code: String)
