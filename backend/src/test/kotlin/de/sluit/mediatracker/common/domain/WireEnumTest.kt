package de.sluit.mediatracker.common.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class WireEnumTest {
    private enum class Sample(override val wire: String) : WireEnum {
        FIRST("first"),
        SECOND_ONE("second_one"),
    }

    @Test
    fun `lookup finds the entry by its wire value`() {
        assertEquals(Sample.SECOND_ONE, Sample.entries.fromWire("sample", "second_one"))
    }

    @Test
    fun `lookup rejects an unknown value naming the field and the allowed values`() {
        val e = assertFailsWith<InvalidValueException> { Sample.entries.fromWire("sample", "FIRST") }
        assertEquals("sample", e.field)
        assertEquals("must be one of first, second_one", e.reason)
    }
}
