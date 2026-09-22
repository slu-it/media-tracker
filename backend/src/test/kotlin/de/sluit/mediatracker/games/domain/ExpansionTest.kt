package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ExpansionTest {
    private fun rejects(field: String, block: () -> Any?) {
        val e = assertFailsWith<InvalidValueException> { block() }
        assertEquals(field, e.field)
    }

    private fun expansion(
        title: String,
        gameId: GameId = GameId.new(),
        sequence: Int = 0,
        id: ExpansionId = ExpansionId.new(),
        ownership: Ownership = Ownership.DEFAULT,
        progress: Progress = Progress.DEFAULT,
    ): Expansion = Expansion(
        id = id,
        gameId = gameId,
        sequence = SequenceNumber(sequence),
        title = Title(title),
        ownership = ownership,
        progress = progress,
    )

    @Test
    fun `sequence number accepts zero and a positive number and rejects a negative one`() {
        assertEquals(0, SequenceNumber(0).value)
        assertEquals(7, SequenceNumber(7).value)
        rejects("sequence") { SequenceNumber(-1) }
    }

    @Test
    fun `expansion id parses only the 36-character hex-dash form and round-trips`() {
        val id = ExpansionId.new()
        assertEquals(36, id.toString().length)
        assertEquals(id, ExpansionId.parse(id.toString()))
        rejects("id") { ExpansionId.parse("nope") }
        rejects("id") { ExpansionId.parse(id.toString().replace("-", "")) }
    }

    @Test
    fun `patch applies only the non-null fields it carries and never touches sequence`() {
        val gameId = GameId.new()
        val original = expansion(
            "Dawnguard",
            gameId = gameId,
            sequence = 2,
            ownership = Ownership.OWNED,
            progress = Progress.PLAYING,
        )

        val unchanged = ExpansionPatch().applyTo(original)
        assertEquals(original, unchanged)

        val retitled = ExpansionPatch(title = Title("Dawnguard Remastered")).applyTo(original)
        assertEquals(Title("Dawnguard Remastered"), retitled.title)
        assertEquals(original.ownership, retitled.ownership)
        assertEquals(original.progress, retitled.progress)
        assertEquals(original.sequence, retitled.sequence)

        val restatused = ExpansionPatch(
            ownership = Ownership.WATCHLIST,
            progress = Progress.FINISHED,
        ).applyTo(original)
        assertEquals(Ownership.WATCHLIST, restatused.ownership)
        assertEquals(Progress.FINISHED, restatused.progress)
        assertEquals(original.title, restatused.title)
        assertEquals(original.sequence, restatused.sequence)

        // sequence is a move request interpreted only by ExpansionService.update, applyTo deliberately ignores it
        val withSequence = ExpansionPatch(sequence = SequenceNumber(9)).applyTo(original)
        assertEquals(original.sequence, withSequence.sequence)
        assertEquals(original, withSequence)
    }
}
