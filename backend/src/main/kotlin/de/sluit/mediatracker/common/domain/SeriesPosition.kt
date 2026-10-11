package de.sluit.mediatracker.common.domain

import java.math.BigDecimal

/**
 * An item's number within one series (book, game) (e.g. 1, 2.5 for a novella, 0 for a prequel): at least 0, at most
 * [MAX_VALUE] and with at most [MAX_SCALE] decimal places, matching the `DECIMAL(6,2)` column. The value must be
 * normalised (no trailing zeros; `BigDecimal.equals` also compares the scale), [of] and [fromDouble] normalise
 * for you.
 */
@JvmInline
value class SeriesPosition(val value: BigDecimal) {
    init {
        requireValid(FIELD, value.signum() >= 0) { "must not be negative" }
        requireValid(FIELD, value <= MAX_VALUE) { "must be at most $MAX_VALUE" }
        requireValid(FIELD, value.stripTrailingZeros().scale() <= MAX_SCALE) {
            "must have at most $MAX_SCALE decimal places"
        }
        requireValid(FIELD, value == value.normalized()) { "must not have trailing zeros" }
    }

    /** Plain decimal text without trailing zeros, e.g. `2.5`, `1`. */
    override fun toString(): String = value.toPlainString()

    companion object {
        const val FIELD = "series"
        const val MAX_SCALE = 2
        val MAX_VALUE: BigDecimal = BigDecimal("9999.99")

        fun of(raw: BigDecimal): SeriesPosition = SeriesPosition(raw.normalized())

        /** The wire form is a JSON number; going through its text keeps 2.5 from becoming 2.4999... */
        fun fromDouble(raw: Double): SeriesPosition = of(
            try {
                BigDecimal(raw.toString())
            } catch (e: NumberFormatException) {
                throw InvalidValueException(FIELD, "must be a finite number")
            },
        )

        private fun BigDecimal.normalized(): BigDecimal =
            stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it }
    }
}
