package de.sluit.mediatracker.dropbox.integration

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.StoredFile
import de.sluit.mediatracker.config.DropboxConfig
import de.sluit.mediatracker.dropbox.domain.AccessGrant
import de.sluit.mediatracker.dropbox.domain.AuthorizationCode
import de.sluit.mediatracker.dropbox.domain.DROPBOX_SOURCE
import de.sluit.mediatracker.dropbox.domain.DropboxApi
import de.sluit.mediatracker.dropbox.domain.DropboxInvalidGrantException
import de.sluit.mediatracker.dropbox.domain.DropboxUnauthorizedException
import de.sluit.mediatracker.dropbox.domain.ExchangeGrant
import de.sluit.mediatracker.dropbox.domain.RefreshToken
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.java.Java
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.encodeToString
import java.io.IOException
import java.util.Base64
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/**
 * Dropbox adapter for [DropboxApi] (MT-024, ADR 0024/0028), modelled on
 * `games/integration/SteamGridDbCoverSource.kt`. Built from [client] (see [dropboxHttpClient] for the engine
 * `Application.kt` wires up only when both `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` are set) and [config] (app
 * key/secret and the base URLs, overridable in tests). The app secret and every access/refresh token are never
 * included in an exception message or a log line.
 */
class DropboxHttpApi(private val client: HttpClient, private val config: DropboxConfig) : DropboxApi {

    override suspend fun exchangeCode(code: AuthorizationCode): ExchangeGrant {
        val response = tokenRequest(
            Parameters.build {
                append("grant_type", "authorization_code")
                append("code", code.value)
            },
        )
        val token = decodeTokenOrThrow(response)
        val refreshToken = token.refreshToken
            ?: throw ExternalSourceException(DROPBOX_SOURCE, "dropbox did not return a refresh token")
        if (refreshToken.length > RefreshToken.MAX_LENGTH) {
            throw ExternalSourceException(DROPBOX_SOURCE, "dropbox returned an oversized refresh token")
        }
        return ExchangeGrant(token.accessToken, RefreshToken(refreshToken), token.expiresIn.seconds)
    }

    override suspend fun refresh(refreshToken: RefreshToken): AccessGrant {
        val response = tokenRequest(
            Parameters.build {
                append("grant_type", "refresh_token")
                append("refresh_token", refreshToken.value)
            },
        )
        val token = decodeTokenOrThrow(response)
        return AccessGrant(token.accessToken, token.expiresIn.seconds)
    }

    override suspend fun revoke(accessToken: String) {
        val response = try {
            client.post("${config.apiBaseUrl}/2/auth/token/revoke") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
            }
        } catch (e: IOException) {
            throw ExternalSourceException(DROPBOX_SOURCE, "request to dropbox revoke failed", e)
        }
        if (!response.status.isSuccess()) {
            val body = readBodyText(response)
            throw ExternalSourceException(
                DROPBOX_SOURCE,
                "dropbox revoke returned status ${response.status.value}".withBodySnippet(body),
            )
        }
    }

    override suspend fun upload(accessToken: String, path: String, content: ByteArray): StoredFile {
        val response = try {
            client.post("${config.contentBaseUrl}/2/files/upload") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                header("Dropbox-API-Arg", uploadArg(path))
                contentType(ContentType.Application.OctetStream)
                setBody(content)
            }
        } catch (e: IOException) {
            throw ExternalSourceException(DROPBOX_SOURCE, "request to dropbox upload failed", e)
        }
        if (response.status == HttpStatusCode.Unauthorized) {
            throw DropboxUnauthorizedException("dropbox upload rejected the access token")
        }
        if (!response.status.isSuccess()) {
            val body = readBodyText(response)
            throw ExternalSourceException(
                DROPBOX_SOURCE,
                "dropbox upload returned status ${response.status.value}".withBodySnippet(body),
            )
        }
        return decode<DbxFileMetadata>(response).toStoredFile(path)
    }

    override suspend fun getMetadata(accessToken: String, path: String): StoredFile? {
        val response = try {
            client.post("${config.apiBaseUrl}/2/files/get_metadata") {
                header(HttpHeaders.Authorization, "Bearer $accessToken")
                contentType(ContentType.Application.Json)
                setBody(dropboxJson.encodeToString(DbxPathRequest(path)))
            }
        } catch (e: IOException) {
            throw ExternalSourceException(DROPBOX_SOURCE, "request to dropbox get_metadata failed", e)
        }
        if (response.status == HttpStatusCode.Unauthorized) {
            throw DropboxUnauthorizedException("dropbox get_metadata rejected the access token")
        }
        if (response.status == HttpStatusCode.Conflict) {
            val body = readBodyText(response)
            val error = decodeTextOrThrow<DbxErrorEnvelope>(body, response.status.value)
            if (error.errorSummary.startsWith("path/not_found")) return null
            throw ExternalSourceException(
                DROPBOX_SOURCE,
                "dropbox get_metadata returned status 409 with ${error.errorSummary}".withBodySnippet(body),
            )
        }
        if (!response.status.isSuccess()) {
            val body = readBodyText(response)
            throw ExternalSourceException(
                DROPBOX_SOURCE,
                "dropbox get_metadata returned status ${response.status.value}".withBodySnippet(body),
            )
        }
        return decode<DbxFileMetadata>(response).toStoredFile(path)
    }

    private suspend fun tokenRequest(parameters: Parameters): HttpResponse = try {
        client.submitForm(url = "${config.apiBaseUrl}/oauth2/token", formParameters = parameters) {
            header(HttpHeaders.Authorization, basicAuthHeader())
        }
    } catch (e: IOException) {
        throw ExternalSourceException(DROPBOX_SOURCE, "request to dropbox oauth2/token failed", e)
    }

    private fun basicAuthHeader(): String {
        val credentials = "${config.appKey}:${config.appSecret}".toByteArray(Charsets.UTF_8)
        return "Basic " + Base64.getEncoder().encodeToString(credentials)
    }

    private suspend fun decodeTokenOrThrow(response: HttpResponse): DbxTokenResponse {
        if (!response.status.isSuccess()) {
            val body = readBodyText(response)
            val error = decodeTextOrNull<DbxOAuthError>(body)
            if (error?.error == "invalid_grant") {
                throw DropboxInvalidGrantException("dropbox rejected the authorization code or refresh token")
            }
            throw ExternalSourceException(
                DROPBOX_SOURCE,
                "dropbox oauth2/token returned status ${response.status.value}".withBodySnippet(body),
            )
        }
        return decode<DbxTokenResponse>(response)
    }

    // The raw exception is never passed as `cause`: it may quote the unparsed response body, which can hold the
    // access or refresh token this same response carried; StatusPages and the backup scheduler log the full cause
    // chain of anything they catch.
    private suspend inline fun <reified T> decode(response: HttpResponse): T = try {
        response.body()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        throw ExternalSourceException(
            DROPBOX_SOURCE,
            "dropbox response could not be parsed (status ${response.status.value})",
        )
    }

    // Reads the raw body once, so callers that also need a typed error DTO (decodeTextOrNull/decodeTextOrThrow
    // below) must parse from this text instead of calling `decode`/`response.body()` again: the underlying
    // channel can only be consumed once.
    private suspend fun readBodyText(response: HttpResponse): String? = try {
        response.bodyAsText()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        null
    }

    private inline fun <reified T> decodeTextOrNull(text: String?): T? {
        if (text.isNullOrBlank()) return null
        return try {
            dropboxJson.decodeFromString<T>(text)
        } catch (e: Exception) {
            null
        }
    }

    private inline fun <reified T> decodeTextOrThrow(text: String?, statusValue: Int): T {
        val parsed = if (text.isNullOrBlank()) {
            null
        } else {
            runCatching {
                dropboxJson.decodeFromString<T>(text)
            }.getOrNull()
        }
        return parsed ?: throw ExternalSourceException(
            DROPBOX_SOURCE,
            "dropbox response could not be parsed (status $statusValue)",
        )
    }

    /**
     * `Dropbox-API-Arg` must be ASCII; our fixed backup path is ASCII already, but every non-ASCII character is
     * escaped as `\uXXXX` defensively, same as Dropbox's own client libraries do.
     */
    private fun uploadArg(path: String): String =
        dropboxJson.encodeToString(DbxUploadArg(path = path, mode = "overwrite", autorename = false, mute = true))
            .escapeNonAscii()

    private fun String.escapeNonAscii(): String = buildString {
        for (ch in this@escapeNonAscii) {
            if (ch.code <= MAX_ASCII_CODE_POINT) append(ch) else append("\\u%04x".format(ch.code))
        }
    }

    // Appends a redacted, collapsed and truncated snippet of a failed response's body to a log-only exception
    // message (never returned to our own API clients, see StatusPages), so a body such as Dropbox's plain-text
    // `Error in call to API function "files/get_metadata": ...` on a 400 is visible in the server log instead of
    // just the bare status code.
    private fun String.withBodySnippet(body: String?): String {
        val snippet = bodySnippet(body) ?: return this
        return "$this: $snippet"
    }

    // Instant.parse throws a plain IllegalArgumentException on a malformed timestamp; caught here (not a suspend
    // function, so no CancellationException can occur) so an odd response from dropbox maps to 502 dropbox_error
    // instead of an uncaught 500.
    private fun DbxFileMetadata.toStoredFile(path: String): StoredFile {
        val modifiedAt = try {
            Instant.parse(serverModified)
        } catch (e: IllegalArgumentException) {
            throw ExternalSourceException(DROPBOX_SOURCE, "dropbox response had a malformed server_modified timestamp")
        }
        return StoredFile(path = path, modifiedAt = modifiedAt, sizeBytes = size)
    }

    private companion object {
        const val MAX_ASCII_CODE_POINT = 127
    }
}

/**
 * The Ktor client `module()` builds only when both `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` are configured: the
 * JDK-backed [Java] engine, a lenient JSON ContentNegotiation, `expectSuccess = false` (this adapter reads the
 * status code itself) and a request timeout generous enough for an upload of the full export.
 */
fun dropboxHttpClient(): HttpClient = HttpClient(Java) {
    expectSuccess = false
    install(ContentNegotiation) {
        json(dropboxJson)
    }
    install(HttpTimeout) {
        requestTimeoutMillis = 30_000
    }
}

private const val BODY_SNIPPET_MAX_LENGTH = 300

// Matches a bearer/access token quoted as a JSON string value, or Dropbox's own `sl.`-prefixed token shape
// wherever it appears (defense in depth: a Dropbox error body should never actually contain one).
private val TOKEN_FIELD_PATTERN = Regex("\"(access_token|refresh_token)\"\\s*:\\s*\"[^\"]*\"")
private val SL_TOKEN_PATTERN = Regex("""sl\.[A-Za-z0-9_-]+""")
private val WHITESPACE_PATTERN = Regex("""\s+""")

/** Redacts, collapses and truncates a raw response body for inclusion in a log-only exception message. */
private fun bodySnippet(body: String?): String? {
    if (body.isNullOrBlank()) return null
    val redacted = redactTokens(body)
    val collapsed = redacted.replace(WHITESPACE_PATTERN, " ").trim()
    if (collapsed.isEmpty()) return null
    return if (collapsed.length > BODY_SNIPPET_MAX_LENGTH) {
        collapsed.take(BODY_SNIPPET_MAX_LENGTH) + "…"
    } else {
        collapsed
    }
}

private fun redactTokens(text: String): String {
    val withoutTokenFields = TOKEN_FIELD_PATTERN.replace(text) { match -> "\"${match.groupValues[1]}\":\"***\"" }
    return SL_TOKEN_PATTERN.replace(withoutTokenFields, "***")
}
