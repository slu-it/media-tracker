package de.sluit.mediatracker.common.domain

/**
 * Tri-state for optional fields in partial updates: leave the field alone, or change it (possibly to null).
 * The API layer builds this from the wire representation (see common/api/PatchField.kt); the domain only applies it.
 */
sealed interface Patch<out T> {
    data object Unchanged : Patch<Nothing>

    /** Set the field to [value]; `null` clears it. */
    data class Change<T>(val value: T?) : Patch<T>
}

fun <T> Patch<T>.applyTo(current: T?): T? = when (this) {
    Patch.Unchanged -> current
    is Patch.Change -> value
}
