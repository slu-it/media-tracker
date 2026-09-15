package de.sluit.mediatracker.common

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

/** `require` for value objects: throws [InvalidValueException] carrying the field name. */
inline fun requireValid(field: String, condition: Boolean, reason: () -> String) {
    if (!condition) throw InvalidValueException(field, reason())
}
