package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Mocks only [GameRepository] and [ExpansionRepository] (the persistence ports); everything else is real, so
 * these tests exercise the actual sequence-assignment, patch-application and reordering logic.
 */
class ExpansionServiceTest {
    private val games = mockk<GameRepository>()
    private val expansions = mockk<ExpansionRepository>()
    private val service = ExpansionService(games, expansions)

    private fun expansion(
        title: String,
        gameId: GameId,
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
    fun `list returns the expansions the repository has for the game`() = runBlocking {
        val gameId = GameId.new()
        coEvery { games.exists(gameId) } returns true
        val expected = listOf(expansion("Shivering Isles", gameId))
        coEvery { expansions.findByGame(gameId) } returns expected

        val result = service.list(gameId)

        assertEquals(expected, result)
    }

    @Test
    fun `list throws NotFoundException when the game does not exist`() = runBlocking {
        val gameId = GameId.new()
        coEvery { games.exists(gameId) } returns false

        val exception = assertFailsWith<NotFoundException> { service.list(gameId) }

        assertEquals(gameId.toString(), exception.id)
    }

    @Test
    fun `create throws NotFoundException when the game does not exist`() = runBlocking {
        val gameId = GameId.new()
        coEvery { games.exists(gameId) } returns false

        val exception = assertFailsWith<NotFoundException> {
            service.create(gameId, NewExpansion(title = Title("Shivering Isles")))
        }

        assertEquals(gameId.toString(), exception.id)
    }

    @Test
    fun `update throws NotFoundException when the game does not exist`() = runBlocking {
        val gameId = GameId.new()
        coEvery { games.exists(gameId) } returns false

        val exception = assertFailsWith<NotFoundException> {
            service.update(gameId, ExpansionId.new(), ExpansionPatch(title = Title("Renamed")))
        }

        assertEquals(gameId.toString(), exception.id)
    }

    @Test
    fun `create appends the new expansion after the existing ones`() = runBlocking {
        val gameId = GameId.new()
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGame(gameId) } returns listOf(
            expansion("Dawnguard", gameId, sequence = 0),
            expansion("Hearthfire", gameId, sequence = 1),
        )
        val inserted = slot<Expansion>()
        coEvery { expansions.insert(capture(inserted)) } just Runs

        val result = service.create(gameId, NewExpansion(title = Title("Dragonborn")))

        assertEquals(SequenceNumber(2), inserted.captured.sequence)
        assertEquals(Title("Dragonborn"), inserted.captured.title)
        assertEquals(gameId, inserted.captured.gameId)
        assertEquals(inserted.captured, result)
    }

    @Test
    fun `update applies title ownership and progress and saves it`() = runBlocking {
        val gameId = GameId.new()
        val id = ExpansionId.new()
        val current = expansion("Old DLC", gameId, id = id, sequence = 0)
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, id) } returns current
        coEvery { expansions.findByGame(gameId) } returns listOf(current)
        val saved = slot<Expansion>()
        coEvery { expansions.update(capture(saved)) } returns true

        val patch = ExpansionPatch(title = Title("New DLC"), ownership = Ownership.OWNED, progress = Progress.FINISHED)
        val result = service.update(gameId, id, patch)

        assertEquals(Title("New DLC"), saved.captured.title)
        assertEquals(Ownership.OWNED, saved.captured.ownership)
        assertEquals(Progress.FINISHED, saved.captured.progress)
        assertEquals(saved.captured, result)
    }

    @Test
    fun `update moves an expansion downward in the order`() = runBlocking {
        val gameId = GameId.new()
        val a = expansion("A", gameId, sequence = 0)
        val b = expansion("B", gameId, sequence = 1)
        val c = expansion("C", gameId, sequence = 2)
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, a.id) } returns a
        coEvery { expansions.findByGame(gameId) } returns listOf(a, b, c)
        coEvery { expansions.update(any()) } returns true
        coEvery { expansions.saveOrder(gameId, any()) } just Runs

        service.update(gameId, a.id, ExpansionPatch(sequence = SequenceNumber(2)))

        coVerify { expansions.saveOrder(gameId, listOf(b.id, c.id, a.id)) }
    }

    @Test
    fun `update moves an expansion upward in the order`() = runBlocking {
        val gameId = GameId.new()
        val a = expansion("A", gameId, sequence = 0)
        val b = expansion("B", gameId, sequence = 1)
        val c = expansion("C", gameId, sequence = 2)
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, c.id) } returns c
        coEvery { expansions.findByGame(gameId) } returns listOf(a, b, c)
        coEvery { expansions.update(any()) } returns true
        coEvery { expansions.saveOrder(gameId, any()) } just Runs

        service.update(gameId, c.id, ExpansionPatch(sequence = SequenceNumber(0)))

        coVerify { expansions.saveOrder(gameId, listOf(c.id, a.id, b.id)) }
    }

    @Test
    fun `update moves an expansion to its current index and leaves the order unchanged`() = runBlocking {
        val gameId = GameId.new()
        val a = expansion("A", gameId, sequence = 0)
        val b = expansion("B", gameId, sequence = 1)
        val c = expansion("C", gameId, sequence = 2)
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, b.id) } returns b
        coEvery { expansions.findByGame(gameId) } returns listOf(a, b, c)
        coEvery { expansions.update(any()) } returns true
        coEvery { expansions.saveOrder(gameId, any()) } just Runs

        service.update(gameId, b.id, ExpansionPatch(sequence = SequenceNumber(1)))

        coVerify { expansions.saveOrder(gameId, listOf(a.id, b.id, c.id)) }
    }

    @Test
    fun `update moves the only expansion in a one-element list to index 0`() = runBlocking {
        val gameId = GameId.new()
        val a = expansion("A", gameId, sequence = 0)
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, a.id) } returns a
        coEvery { expansions.findByGame(gameId) } returns listOf(a)
        coEvery { expansions.update(any()) } returns true
        coEvery { expansions.saveOrder(gameId, any()) } just Runs

        val result = service.update(gameId, a.id, ExpansionPatch(sequence = SequenceNumber(0)))

        coVerify { expansions.saveOrder(gameId, listOf(a.id)) }
        assertEquals(SequenceNumber(0), result.sequence)
    }

    @Test
    fun `update returns the expansion with its new sequence after a move`() = runBlocking {
        val gameId = GameId.new()
        val a = expansion("A", gameId, sequence = 0)
        val b = expansion("B", gameId, sequence = 1)
        val c = expansion("C", gameId, sequence = 2)
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, a.id) } returns a
        coEvery { expansions.findByGame(gameId) } returns listOf(a, b, c)
        coEvery { expansions.update(any()) } returns true
        coEvery { expansions.saveOrder(gameId, any()) } just Runs

        val result = service.update(gameId, a.id, ExpansionPatch(sequence = SequenceNumber(2)))

        assertEquals(SequenceNumber(2), result.sequence)
    }

    @Test
    fun `update with a sequence outside the current range throws InvalidValueException and writes nothing`() =
        runBlocking {
            val gameId = GameId.new()
            val a = expansion("A", gameId, sequence = 0)
            val b = expansion("B", gameId, sequence = 1)
            coEvery { games.exists(gameId) } returns true
            coEvery { expansions.findByGameAndId(gameId, a.id) } returns a
            coEvery { expansions.findByGame(gameId) } returns listOf(a, b)

            val exception = assertFailsWith<InvalidValueException> {
                service.update(gameId, a.id, ExpansionPatch(sequence = SequenceNumber(5)))
            }

            assertEquals(SequenceNumber.FIELD, exception.field)
            coVerify(exactly = 0) { expansions.update(any()) }
            coVerify(exactly = 0) { expansions.saveOrder(any(), any()) }
        }

    @Test
    fun `update throws NotFoundException when the repository finds no expansion for that game`() = runBlocking {
        // findByGameAndId is what scopes the lookup to the parent game; the repository returns null both for an
        // unknown id and for an id that belongs to a different game (pinned in ExposedExpansionRepositoryTest).
        val gameId = GameId.new()
        val id = ExpansionId.new()
        coEvery { games.exists(gameId) } returns true
        coEvery { expansions.findByGameAndId(gameId, id) } returns null

        val exception = assertFailsWith<NotFoundException> {
            service.update(gameId, id, ExpansionPatch(title = Title("Renamed")))
        }

        assertEquals(id.toString(), exception.id)
    }

    @Test
    fun `delete removes the expansion and re-packs the remaining order`() = runBlocking {
        val gameId = GameId.new()
        val a = expansion("A", gameId, sequence = 0)
        val b = expansion("B", gameId, sequence = 1)
        coEvery { expansions.findByGameAndId(gameId, a.id) } returns a
        coEvery { expansions.deleteById(a.id) } returns 1
        coEvery { expansions.findByGame(gameId) } returns listOf(b)
        coEvery { expansions.saveOrder(gameId, any()) } just Runs

        service.delete(gameId, a.id)

        coVerify { expansions.saveOrder(gameId, listOf(b.id)) }
    }

    @Test
    fun `delete of an unknown id does nothing`() = runBlocking {
        val gameId = GameId.new()
        val id = ExpansionId.new()
        coEvery { expansions.findByGameAndId(gameId, id) } returns null

        service.delete(gameId, id)

        coVerify(exactly = 0) { expansions.deleteById(any()) }
        coVerify(exactly = 0) { expansions.saveOrder(any(), any()) }
    }

    @Test
    fun `delete with a game id that does not exist is a no-op`() = runBlocking {
        // Pins the deliberate choice that delete skips the game-exists check: an unknown game id simply means the
        // repository finds nothing for it, exactly like an unknown expansion id.
        val gameId = GameId.new()
        val id = ExpansionId.new()
        coEvery { expansions.findByGameAndId(gameId, id) } returns null

        service.delete(gameId, id)

        coVerify(exactly = 0) { games.exists(any()) }
        coVerify(exactly = 0) { expansions.deleteById(any()) }
        coVerify(exactly = 0) { expansions.saveOrder(any(), any()) }
    }
}
