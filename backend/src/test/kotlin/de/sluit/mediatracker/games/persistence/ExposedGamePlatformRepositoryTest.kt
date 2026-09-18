package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.domain.GamePlatformId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

class ExposedGamePlatformRepositoryTest {

    @Test
    fun `findAll returns the four seeded platforms sorted by label`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val all = repo.findAll()

        assertEquals(listOf("Nintendo", "PC", "PlayStation", "Xbox"), all.map { it.label.value })
        assertEquals(
            setOf(SeededPlatforms.PC, SeededPlatforms.PLAYSTATION, SeededPlatforms.XBOX, SeededPlatforms.NINTENDO),
            all.map { it.id.toString() }.toSet(),
        )
        assertEquals("757575", all.single { it.label.value == "PC" }.color.value)
    }

    @Test
    fun `findByIds returns only the requested platforms`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val result = repo.findByIds(setOf(Platforms.PC.id, Platforms.XBOX.id))

        assertEquals(setOf(Platforms.PC, Platforms.XBOX), result.toSet())
    }

    @Test
    fun `findByIds ignores unknown ids`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val result = repo.findByIds(setOf(Platforms.PC.id, GamePlatformId(Uuid.random())))

        assertEquals(listOf(Platforms.PC), result)
    }

    @Test
    fun `findByIds with an empty set returns an empty list without a query`() = withFreshDatabase { db ->
        val repo = ExposedGamePlatformRepository()

        val count = countStatements(db.database) { assertTrue(repo.findByIds(emptySet()).isEmpty()) }

        assertEquals(0, count)
    }
}
