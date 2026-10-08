package de.sluit.mediatracker.common.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class VocabularyTest {
    private fun rejects(field: String, block: () -> Any?) {
        val e = assertFailsWith<InvalidValueException> { block() }
        assertEquals(field, e.field)
    }

    @Test
    fun `vocabulary name must be non-blank trimmed and at most 128 characters`() {
        rejects("name") { VocabularyName("") }
        rejects("name") { VocabularyName("   ") }
        rejects("name") { VocabularyName(" Nintendo") }
        rejects("name") { VocabularyName("x".repeat(129)) }
        assertEquals("Nintendo", VocabularyName.parse("  Nintendo  ").value)
    }

    @Test
    fun `vocabulary search limit is bounded`() {
        rejects("limit") { VocabularySearchLimit(0) }
        rejects("limit") { VocabularySearchLimit(51) }
        assertEquals(10, VocabularySearchLimit.DEFAULT.value)
        assertEquals(50, VocabularySearchLimit(50).value)
    }
}
