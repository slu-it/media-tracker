package de.sluit.mediatracker.common.domain

/** An enum whose values travel as a [wire] string in the column, the DTO and the MCP schema alike (ADR 0017). */
interface WireEnum {
    val wire: String
}

/**
 * Looks up the entry whose [WireEnum.wire] equals [raw], throwing [InvalidValueException] naming [field]
 * otherwise. Meant for `Enum.entries`: `entries.fromWire(FIELD, wire)`.
 */
fun <E : WireEnum> Iterable<E>.fromWire(field: String, raw: String): E = firstOrNull { it.wire == raw }
    ?: throw InvalidValueException(field, "must be one of ${joinToString { it.wire }}")
