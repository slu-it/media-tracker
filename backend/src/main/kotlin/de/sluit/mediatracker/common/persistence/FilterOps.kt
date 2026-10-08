package de.sluit.mediatracker.common.persistence

import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.inList

/**
 * `column IN (values)`, or `null` (no filter on this category) when [values] is empty. The guard is not
 * cosmetic: Exposed renders inList(emptyList()) as the literal FALSE, so an empty set would silently return
 * zero rows instead of "no filter on this category".
 */
fun <T> Column<T>.inListIfAny(values: Collection<T>): Op<Boolean>? = if (values.isEmpty()) null else this inList values
