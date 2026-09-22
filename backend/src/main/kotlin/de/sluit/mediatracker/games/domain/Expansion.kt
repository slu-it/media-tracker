package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.requireValid
import kotlin.uuid.Uuid

/*
 * Value and entity objects of the game expansions domain (MT-016, ADR 0023). An expansion (DLC) belongs to
 * exactly one game and reuses the game's own `Title`, `Ownership` and `Progress` value objects; only the id and
 * the manual ordering are specific to an expansion.
 */

@JvmInline
value class ExpansionId(val value: Uuid) {
    /** 36-character hex-dash form, the same string that is stored in the CHAR(36) column. */
    override fun toString(): String = value.toString()

    companion object {
        const val FIELD = "id"

        fun new(): ExpansionId = ExpansionId(Uuid.random())

        fun parse(raw: String): ExpansionId =
            ExpansionId(Uuid.parseHexDashOrNull(raw) ?: throw InvalidValueException(FIELD, "must be a UUID"))
    }
}

/**
 * An expansion's position among its game's expansions. [ExpansionService] is the sole owner of the invariant
 * that the sequence numbers of one game's expansions are dense and zero-based (0..n-1); a value object only
 * guarantees the shape (never negative).
 */
@JvmInline
value class SequenceNumber(val value: Int) {
    init {
        requireValid(FIELD, value >= 0) { "must not be negative" }
    }

    companion object {
        const val FIELD = "sequence"
        const val FIRST = 0
    }
}

/** An expansion (DLC) of a game, as the business layer sees it. All fields are validated value objects. */
data class Expansion(
    val id: ExpansionId,
    val gameId: GameId,
    val sequence: SequenceNumber,
    val title: Title,
    val ownership: Ownership = Ownership.DEFAULT,
    val progress: Progress = Progress.DEFAULT,
)

/** Everything needed to create an expansion; the id, game id and sequence are assigned by [ExpansionService]. */
data class NewExpansion(
    val title: Title,
    val ownership: Ownership = Ownership.DEFAULT,
    val progress: Progress = Progress.DEFAULT,
)

/**
 * Partial update. `null` means "leave unchanged" for every field: unlike a game's optional fields, no expansion
 * field can ever be cleared, so there is no need for `Patch`/`PatchField` here. A non-null [sequence] is a move
 * request rather than a plain field change, so [applyTo] deliberately leaves it alone; [ExpansionService.update]
 * is the only place that interprets it.
 */
data class ExpansionPatch(
    val title: Title? = null,
    val ownership: Ownership? = null,
    val progress: Progress? = null,
    val sequence: SequenceNumber? = null,
) {
    /** Applies every field except [sequence] (see class KDoc). */
    fun applyTo(expansion: Expansion): Expansion = expansion.copy(
        title = title ?: expansion.title,
        ownership = ownership ?: expansion.ownership,
        progress = progress ?: expansion.progress,
    )
}
