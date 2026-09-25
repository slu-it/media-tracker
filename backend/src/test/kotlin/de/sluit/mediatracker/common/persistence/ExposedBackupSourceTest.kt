package de.sluit.mediatracker.common.persistence

import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.domain.Description
import de.sluit.mediatracker.games.domain.Expansion
import de.sluit.mediatracker.games.domain.ExpansionId
import de.sluit.mediatracker.games.domain.Ownership
import de.sluit.mediatracker.games.domain.Progress
import de.sluit.mediatracker.games.domain.Rating
import de.sluit.mediatracker.games.domain.SequenceNumber
import de.sluit.mediatracker.games.domain.Title
import de.sluit.mediatracker.games.game
import de.sluit.mediatracker.games.persistence.ExposedExpansionRepository
import de.sluit.mediatracker.games.persistence.ExposedGameRepository
import de.sluit.mediatracker.games.persistence.GamesBackupSource
import de.sluit.mediatracker.games.persistence.GamesTable
import org.jetbrains.exposed.v1.jdbc.deleteAll
import org.jetbrains.exposed.v1.jdbc.selectAll
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.uuid.Uuid

/**
 * Tests [ExposedBackupSource] through its only real wiring, [GamesBackupSource] (MT-023, ADR 0027): the generic
 * class owns no tables of its own. `game_platforms` is never truncated by [withFreshDatabase], so it doubles as
 * the "insert if absent" coverage for the V002-seeded platforms.
 */
class ExposedBackupSourceTest {

    @Test
    fun `export then import after deleting the rows reproduces every field including nulls doubles and booleans`() =
        withFreshDatabase {
            val games = ExposedGameRepository()
            val expansions = ExposedExpansionRepository()
            val withEverything = game(
                "Celeste",
                platforms = listOf(Platforms.PC, Platforms.PLAYSTATION),
                description = Description("A climbing game"),
                rating = Rating(4.5),
                hidden = true,
                ownership = Ownership.OWNED,
                progress = Progress.FINISHED,
            )
            val bareMinimum = game("Hades", platforms = listOf(Platforms.XBOX))
            games.insert(withEverything)
            games.insert(bareMinimum)
            expansions.insert(
                Expansion(
                    id = ExpansionId.new(),
                    gameId = withEverything.id,
                    sequence = SequenceNumber(0),
                    title = Title("Farewell"),
                    ownership = Ownership.OWNED,
                    progress = Progress.FINISHED,
                ),
            )

            val exported = GamesBackupSource.export()

            dbQuery { GamesTable.deleteAll() } // cascades to game_to_platform and game_expansions

            val result = GamesBackupSource.import(exported)

            assertEquals(2, result.getValue("games").inserted)
            assertEquals(0, result.getValue("games").skipped)
            assertEquals(exported, GamesBackupSource.export())
        }

    @Test
    fun `a second import of the same export skips every row`() = withFreshDatabase {
        val games = ExposedGameRepository()
        games.insert(game("Celeste"))
        val exported = GamesBackupSource.export()
        dbQuery { GamesTable.deleteAll() }

        val first = GamesBackupSource.import(exported)
        assertEquals(1, first.getValue("games").inserted)
        assertEquals(0, first.getValue("games").skipped)

        val second = GamesBackupSource.import(exported)
        assertEquals(0, second.getValue("games").inserted)
        assertEquals(1, second.getValue("games").skipped)
        assertEquals(0, second.getValue("game_to_platform").inserted)
        assertEquals(1, second.getValue("game_to_platform").skipped)
    }

    @Test
    fun `importing the seeded platforms skips all four`() = withFreshDatabase {
        val exported = GamesBackupSource.export()

        val result = GamesBackupSource.import(mapOf("game_platforms" to exported.getValue("game_platforms")))

        assertEquals(0, result.getValue("game_platforms").inserted)
        assertEquals(4, result.getValue("game_platforms").skipped)
    }

    @Test
    fun `import rejects a row with an unknown column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("bogus" to "nope")

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a row missing a column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() - "hidden"

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a null value for a non-null column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("hidden" to null)

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.hidden", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a string value for a boolean column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("hidden" to "yes")

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.hidden", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects an out-of-range long for an integer column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("release_year" to 99_999_999_999L)

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.release_year", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a double value for an integer column and writes nothing`() = withFreshDatabase {
        val row = validGameRow() + ("release_year" to 1.5)

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.release_year", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects a title longer than the varchar column and writes nothing`() = withFreshDatabase {
        val row = validGameRow(title = "a".repeat(257))

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.title", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects an id longer than the char column and writes nothing`() = withFreshDatabase {
        val row = validGameRow(id = "a".repeat(37))

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(row)))
        }

        assertEquals("games.id", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `import rejects two rows sharing a primary key and writes nothing`() = withFreshDatabase {
        val id = Uuid.random().toString()
        val rows = listOf(validGameRow(id = id, title = "Celeste"), validGameRow(id = id, title = "Hades"))

        val exception = assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to rows))
        }

        assertEquals("games", exception.field)
        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    @Test
    fun `a whole-number json value for a double column round-trips as a double`() = withFreshDatabase {
        val row = validGameRow() + ("rating" to 4L)

        GamesBackupSource.import(mapOf("games" to listOf(row)))

        val exported = GamesBackupSource.export().getValue("games").single()
        assertEquals(4.0, exported["rating"])
    }

    @Test
    fun `importing a row whose primary key differs only by case from an existing row is skipped`() = withFreshDatabase {
        val games = ExposedGameRepository()
        val existing = game("Celeste")
        games.insert(existing)
        val row = validGameRow(id = existing.id.toString().uppercase(), title = "Celeste")

        val result = GamesBackupSource.import(mapOf("games" to listOf(row)))

        assertEquals(0, result.getValue("games").inserted)
        assertEquals(1, result.getValue("games").skipped)
    }

    @Test
    fun `a dangling foreign key rolls back the whole source`() = withFreshDatabase {
        val gameId = Uuid.random().toString()
        val gameRow = validGameRow(id = gameId)
        val danglingLink: BackupRow = mapOf(
            "game_id" to gameId,
            "platform_id" to Uuid.random().toString(), // no such platform
        )

        assertFailsWith<InvalidValueException> {
            GamesBackupSource.import(mapOf("games" to listOf(gameRow), "game_to_platform" to listOf(danglingLink)))
        }

        assertEquals(0L, dbQuery { GamesTable.selectAll().count() })
    }

    private fun validGameRow(
        id: String = Uuid.random().toString(),
        title: String = "Celeste",
        releaseYear: Long = 2018L,
        description: String? = null,
        rating: Double? = null,
        coverImageUrl: String? = null,
        ownership: String = Ownership.DEFAULT.wire,
        progress: String = Progress.DEFAULT.wire,
        hidden: Boolean = false,
    ): BackupRow = mapOf(
        "id" to id,
        "title" to title,
        "release_year" to releaseYear,
        "description" to description,
        "rating" to rating,
        "cover_image_url" to coverImageUrl,
        "ownership" to ownership,
        "progress" to progress,
        "hidden" to hidden,
    )
}
