package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.GameId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.game
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Builds a valid [Expansion] for tests, defaulting to a fresh id and the first sequence slot. */
private fun expansion(
    gameId: GameId,
    title: String = "DLC",
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

class ExposedExpansionRepositoryTest {

    @Test
    fun `insert then findByGameAndId returns the expansion with every field intact`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)
        val inserted = expansion(
            gameId = theGame.id,
            title = "Farewell",
            sequence = 2,
            ownership = Ownership.OWNED,
            progress = Progress.FINISHED,
        )
        repo.insert(inserted)

        val found = repo.findByGameAndId(theGame.id, inserted.id)

        assertEquals(inserted, found)
    }

    @Test
    fun `findByGameAndId of an unknown id returns null`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)

        assertEquals(null, repo.findByGameAndId(theGame.id, ExpansionId.new()))
    }

    @Test
    fun `findByGameAndId of an expansion belonging to a different game returns null`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        val otherGame = game("Hades")
        gameRepo.insert(theGame)
        gameRepo.insert(otherGame)
        val inserted = expansion(theGame.id, title = "Farewell")
        repo.insert(inserted)

        assertEquals(null, repo.findByGameAndId(otherGame.id, inserted.id))
    }

    @Test
    fun `findByGame returns only that game's expansions ordered by sequence`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        val otherGame = game("Hades")
        gameRepo.insert(theGame)
        gameRepo.insert(otherGame)
        // Inserted out of order so the test cannot pass by accident: findByGame must ORDER BY sequence
        // itself rather than relying on insertion order.
        val second = expansion(theGame.id, title = "Second", sequence = 1)
        val first = expansion(theGame.id, title = "First", sequence = 0)
        val third = expansion(theGame.id, title = "Third", sequence = 2)
        val otherGameExpansion = expansion(otherGame.id, title = "Other")
        repo.insert(second)
        repo.insert(third)
        repo.insert(first)
        repo.insert(otherGameExpansion)

        val found = repo.findByGame(theGame.id)

        assertEquals(listOf(first.id, second.id, third.id), found.map { it.id })
    }

    @Test
    fun `update changes the stored fields and returns true`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)
        val original = expansion(
            theGame.id,
            title = "DLC",
            ownership = Ownership.WATCHLIST,
            progress = Progress.NOT_STARTED,
        )
        repo.insert(original)

        val updated = original.copy(
            title = Title("DLC (updated)"),
            ownership = Ownership.OWNED,
            progress = Progress.PLAYING,
        )
        val result = repo.update(updated)

        assertTrue(result)
        val found = repo.findByGameAndId(theGame.id, original.id)
        assertEquals(updated, found)
    }

    @Test
    fun `update of an unknown id returns false`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)
        val unknown = expansion(theGame.id, title = "Ghost")

        val result = repo.update(unknown)

        assertFalse(result)
    }

    @Test
    fun `saveOrder renumbers to 0 through n-1 in the given order`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)
        val a = expansion(theGame.id, title = "A", sequence = 0)
        val b = expansion(theGame.id, title = "B", sequence = 1)
        val c = expansion(theGame.id, title = "C", sequence = 2)
        repo.insert(a)
        repo.insert(b)
        repo.insert(c)

        repo.saveOrder(theGame.id, listOf(c.id, a.id, b.id))

        val found = repo.findByGame(theGame.id)
        assertEquals(listOf(c.id, a.id, b.id), found.map { it.id })
        assertEquals(listOf(0, 1, 2), found.map { it.sequence.value })
    }

    @Test
    fun `deleteById removes the row and returns the count`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)
        val inserted = expansion(theGame.id, title = "DLC")
        repo.insert(inserted)

        assertEquals(1, repo.deleteById(inserted.id))
        assertEquals(0, repo.deleteById(inserted.id))
    }

    @Test
    fun `deleting the game cascades to its expansions`() = withFreshDatabase {
        val gameRepo = ExposedGameRepository()
        val repo = ExposedExpansionRepository()
        val theGame = game("Celeste")
        gameRepo.insert(theGame)
        repo.insert(expansion(theGame.id, title = "DLC One", sequence = 0))
        repo.insert(expansion(theGame.id, title = "DLC Two", sequence = 1))

        gameRepo.deleteById(theGame.id)

        assertTrue(repo.findByGame(theGame.id).isEmpty())
    }
}
