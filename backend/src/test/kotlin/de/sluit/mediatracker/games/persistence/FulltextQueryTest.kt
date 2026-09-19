package de.sluit.mediatracker.games.persistence

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FulltextQueryTest {
    @Test
    fun `every word gets a prefix wildcard`() {
        assertEquals("zelda* breath*", FulltextQuery.booleanMode("zelda breath"))
    }

    @Test
    fun `boolean mode operators are stripped from the words`() {
        assertEquals("hades*", FulltextQuery.booleanMode("-hades"))
        assertEquals("exact* phrase*", FulltextQuery.booleanMode("\"exact phrase\""))
    }

    @Test
    fun `a hyphen splits a word into two prefix terms`() {
        assertEquals("spider* man*", FulltextQuery.booleanMode("spider-man"))
    }

    @Test
    fun `an input of only operators yields no query`() {
        assertNull(FulltextQuery.booleanMode("+-<>()~*\"@"))
    }

    @Test
    fun `surplus whitespace produces no empty terms`() {
        assertEquals("zelda* breath*", FulltextQuery.booleanMode("  zelda   breath  "))
    }
}
