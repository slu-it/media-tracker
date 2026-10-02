package de.sluit.mediatracker.auth.api

import io.ktor.http.decodeURLPart
import io.ktor.http.encodeURLParameter

/** Query parameter carrying the post-login return target on the login page URL. */
const val RETURN_TO_PARAM = "returnTo"

private const val MAX_RETURN_PATH_LENGTH = 2048
private val BLOCKED_FIRST_SEGMENTS = setOf("login", "logout")
private val PRINTABLE_ASCII = '\u0021'..'\u007E'

/**
 * Validates a post-login return target: only a same-origin relative path starting with exactly one `/` passes.
 * Rejects blank values, `//host`, backslashes, schemes, anything outside printable ASCII (real targets are raw,
 * percent-encoded request URIs), over-long values and the `/login` and `/logout` routes themselves, compared
 * case-insensitively after percent-decoding, dropping `;` parameters and resolving dot segments. Returns [raw]
 * unchanged when safe, else null.
 */
fun safeReturnPath(raw: String?): String? {
    if (raw.isNullOrBlank() || raw.length > MAX_RETURN_PATH_LENGTH) return null
    if (!raw.startsWith("/") || raw.startsWith("//")) return null
    if (raw.any { it == '\\' || it !in PRINTABLE_ASCII }) return null
    if (isLoginOrLogout(raw)) return null
    return raw
}

private fun isLoginOrLogout(raw: String): Boolean {
    val pathPart = raw.substringBefore('?').substringBefore('#')
    val decoded = try {
        pathPart.decodeURLPart()
    } catch (_: Exception) {
        return true
    }
    val resolved = ArrayDeque<String>()
    for (segment in decoded.split('/')) {
        when (val name = segment.substringBefore(';')) {
            "", "." -> Unit
            ".." -> resolved.removeLastOrNull()
            else -> resolved.addLast(name.lowercase())
        }
    }
    return resolved.firstOrNull() in BLOCKED_FIRST_SEGMENTS
}

/** The login page URL, carrying [returnTo] (already validated) and optionally the error flag. */
internal fun loginUrl(returnTo: String? = null, error: Boolean = false): String {
    val params = buildList {
        if (error) add("error=1")
        if (returnTo != null) add("$RETURN_TO_PARAM=" + returnTo.encodeURLParameter())
    }
    return if (params.isEmpty()) "/login" else "/login?" + params.joinToString("&")
}
