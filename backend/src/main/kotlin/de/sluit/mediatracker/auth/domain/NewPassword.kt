package de.sluit.mediatracker.auth.domain

import de.sluit.mediatracker.common.domain.requireValid

/**
 * A new password accepted by [AuthService.changePassword] (self-service change) and the `CreateUser` CLI
 * (bootstrap / `--reset-password`); [violation] is the one place the length rule lives, so both share it.
 *
 * Wraps a `String`, not a `CharArray`: Kotlin value classes cannot override `equals`/`hashCode`
 * (`RESERVED_MEMBER_INSIDE_VALUE_CLASS`), so a `CharArray`-backed value class would compare by array reference
 * only, which is both semantically wrong and makes literal-argument matching in tests unreliable. `toCharArray`
 * still hands [AuthService.changePassword] the array shape [PasswordHasher] expects, but unlike the `current`
 * password (a caller-supplied `CharArray`, zeroed after use like `login`'s), the plaintext here stays in the
 * (immutable) `String` until it is garbage collected. `toString` is redacted so it never leaks into logs or
 * exception messages.
 */
@JvmInline
value class NewPassword(private val value: String) {
    init {
        val problem = violation(value.length)
        requireValid("newPassword", problem == null) { problem!! }
    }

    fun toCharArray(): CharArray = value.toCharArray()

    override fun toString() = "NewPassword(redacted)"

    companion object {
        const val MIN_LENGTH = 8
        const val MAX_LENGTH = 1024

        /**
         * The one place the length rule lives, so a future change to it reaches both [NewPassword]'s own `init`
         * and the `CreateUser` CLI. Returns the rejection reason, or null when [length] is acceptable.
         */
        fun violation(length: Int): String? = when {
            length < MIN_LENGTH -> "must be at least $MIN_LENGTH characters long"
            length > MAX_LENGTH -> "must be at most $MAX_LENGTH characters long"
            else -> null
        }
    }
}
