package de.sluit.mediatracker.dropbox.integration

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Wire shapes for the Dropbox API (MT-024, ADR 0024/0028). Internal to this adapter; [DropboxHttpApi] is the only
 * thing that sees them and maps them to the domain's `AccessGrant`/`ExchangeGrant`/`StoredFile`.
 */
@Serializable
internal data class DbxTokenResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("expires_in") val expiresIn: Long,
    @SerialName("refresh_token") val refreshToken: String? = null,
)

/** `oauth2/token` error body, e.g. `{"error":"invalid_grant","error_description":"..."}`. */
@Serializable
internal data class DbxOAuthError(
    val error: String? = null,
    @SerialName("error_description") val errorDescription: String? = null,
)

/**
 * `Dropbox-API-Arg` header body of `files/upload`. No default values: kotlinx.serialization omits a property
 * equal to its default, but Dropbox needs `mode`/`autorename`/`mute` sent explicitly on every request, so
 * [DropboxHttpApi] always passes them.
 */
@Serializable
internal data class DbxUploadArg(val path: String, val mode: String, val autorename: Boolean, val mute: Boolean)

/** Body of `files/get_metadata`. */
@Serializable
internal data class DbxPathRequest(val path: String)

/** Success body of both `files/upload` and `files/get_metadata` (a Dropbox `FileMetadata`). */
@Serializable
internal data class DbxFileMetadata(@SerialName("server_modified") val serverModified: String, val size: Long)

/** Error body of a 409 `files/get_metadata` response, e.g. `error_summary: "path/not_found/..."`. */
@Serializable
internal data class DbxErrorEnvelope(@SerialName("error_summary") val errorSummary: String)

/** Lenient Json for the client's ContentNegotiation: Dropbox's payloads carry fields we do not model. */
internal val dropboxJson = Json { ignoreUnknownKeys = true }
