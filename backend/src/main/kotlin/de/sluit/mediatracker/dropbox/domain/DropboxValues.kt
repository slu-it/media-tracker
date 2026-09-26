package de.sluit.mediatracker.dropbox.domain

import de.sluit.mediatracker.common.domain.requireValid

/*
 * Value objects of the dropbox domain (MT-024, ADR 0028). Every class validates itself in `init`, mirroring
 * games/domain/GameValues.kt.
 */

/** The one-time code the user pastes from Dropbox's authorization page. Arrives as untrusted request input. */
@JvmInline
value class AuthorizationCode(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    /** Masked: a pasted code is short-lived but still a credential, never logged or echoed back in full. */
    override fun toString(): String = "AuthorizationCode(***)"

    companion object {
        const val FIELD = "code"
        const val MAX_LENGTH = 512
    }
}

/** The long-lived credential Dropbox exchanges the [AuthorizationCode] for; stored in `oauth_connections`. */
@JvmInline
value class RefreshToken(val value: String) {
    init {
        requireValid(FIELD, value.isNotBlank()) { "must not be blank" }
        requireValid(FIELD, value.length <= MAX_LENGTH) { "must be at most $MAX_LENGTH characters" }
    }

    /** Masked: never logged or included in an exception message. */
    override fun toString(): String = "RefreshToken(***)"

    companion object {
        const val FIELD = "refreshToken"
        const val MAX_LENGTH = 512
    }
}
