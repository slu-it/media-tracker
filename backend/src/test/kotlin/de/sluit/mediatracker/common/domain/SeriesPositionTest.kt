package de.sluit.mediatracker.common.domain

import java.math.BigDecimal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class SeriesPositionTest {
    private fun rejects(field: String, block: () -> Any?) {
        val e = assertFailsWith<InvalidValueException> { block() }
        assertEquals(field, e.field)
    }

    @Test
    fun `a series position accepts the boundaries and normalises trailing zeros`() {
        assertEquals(BigDecimal.ZERO, SeriesPosition.fromDouble(0.0).value)
        assertEquals(BigDecimal("9999.99"), SeriesPosition.fromDouble(9999.99).value)
        assertEquals(BigDecimal("2.5"), SeriesPosition.fromDouble(2.5).value)
        assertEquals(SeriesPosition.fromDouble(2.5), SeriesPosition.of(BigDecimal("2.50")))
        assertEquals("1", SeriesPosition.fromDouble(1.0).toString())
        assertEquals("10", SeriesPosition.of(BigDecimal("10.00")).toString())
        assertEquals("0.25", SeriesPosition.fromDouble(0.25).toString())
    }

    @Test
    fun `a series position rejects a value that is not normalised`() {
        rejects("series") { SeriesPosition(BigDecimal("2.50")) }
        rejects("series") { SeriesPosition(BigDecimal("1E+1")) }
        rejects("series") { SeriesPosition(BigDecimal("0.00")) }
        assertEquals(BigDecimal("10"), SeriesPosition(BigDecimal("10")).value)
        assertEquals(BigDecimal.ZERO, SeriesPosition(BigDecimal.ZERO).value)
    }

    @Test
    fun `a series position rejects negative, too large and too precise numbers`() {
        rejects("series") { SeriesPosition.fromDouble(-1.0) }
        rejects("series") { SeriesPosition.fromDouble(10000.0) }
        rejects("series") { SeriesPosition.fromDouble(9999.991) }
        rejects("series") { SeriesPosition.fromDouble(1.234) }
        rejects("series") { SeriesPosition.fromDouble(Double.NaN) }
        rejects("series") { SeriesPosition.fromDouble(Double.POSITIVE_INFINITY) }
    }
}
