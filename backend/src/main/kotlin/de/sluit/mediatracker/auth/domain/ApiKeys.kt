package de.sluit.mediatracker.auth.domain

import kotlin.uuid.Uuid

/*
 * Value objects for per-user API keys. Unlike the games domain's ids (GameValues.kt), an API key never
 * rejects malformed input with InvalidValueException: it arrives as a bearer credential from arbitrary
 * clients, so a bad key is simply "not authenticated" (null), never a 400. See [ApiKeyService.authenticate].
 */

/** A bearer credential for the HTTP API, stored on [de.sluit.mediatracker.auth.domain.User] in one of two slots. */
@JvmInline
value class ApiKey(val value: Uuid) {
    /** 36-character hex-dash form, the same string that is stored in the CHAR(36) column. */
    override fun toString(): String = value.toString()

    companion object {
        /** A new, unpredictable key (SecureRandom-backed on the JVM). */
        fun generate(): ApiKey = ApiKey(Uuid.random())

        /** Parses the 36-character hex-dash form, or null if [text] is not a valid UUID. */
        fun parseOrNull(text: String): ApiKey? = Uuid.parseHexDashOrNull(text)?.let(::ApiKey)
    }
}

/** The two independent slots a user's API keys can occupy, so a key can be rotated without downtime. */
enum class ApiKeySlot { PRIMARY, SECONDARY }

/** A user's current API keys; either slot may be unset. */
data class ApiKeys(val primary: ApiKey?, val secondary: ApiKey?)
