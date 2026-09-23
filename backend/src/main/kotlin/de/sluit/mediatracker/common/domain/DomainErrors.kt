package de.sluit.mediatracker.common.domain

/**
 * A value object rejected its input. [field] is the JSON property (or query/path parameter) name that API
 * clients see in the error message, so value classes name the field they represent.
 *
 * Extends [IllegalArgumentException] to keep `require`-like semantics, but only this exact type is mapped to
 * HTTP 400 (see plugins/StatusPages.kt); a bare IllegalArgumentException from elsewhere is still a 500.
 */
class InvalidValueException(val field: String, val reason: String) : IllegalArgumentException("$field: $reason")

/** A business object addressed by id does not exist. Mapped to HTTP 404 for API calls. */
class NotFoundException(val resource: String, val id: String) : RuntimeException("$resource $id not found")

/**
 * An outward integration ([source], e.g. `cover_source`) is not configured, so the call was never attempted.
 * Mapped to HTTP 503 `"${source}_unavailable"` (see plugins/StatusPages.kt).
 */
class ExternalSourceUnavailableException(val source: String) : RuntimeException("$source is not configured")

/**
 * An outward integration ([source]) was called but failed (non-2xx response, malformed payload, or an I/O
 * error). [message] and [cause] are for logging only; mapped to HTTP 502 `"${source}_error"` with a fixed,
 * generic response message so the upstream body is never leaked (see plugins/StatusPages.kt).
 */
class ExternalSourceException(val source: String, message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

/** `require` for value objects: throws [InvalidValueException] carrying the field name. */
inline fun requireValid(field: String, condition: Boolean, reason: () -> String) {
    if (!condition) throw InvalidValueException(field, reason())
}
