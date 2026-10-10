package de.sluit.mediatracker.games.persistence

import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.RenameOutcome
import de.sluit.mediatracker.common.persistence.countStatements
import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.games.Platforms
import de.sluit.mediatracker.games.SeededPlatforms
import de.sluit.mediatracker.games.domain.GamePlatform
import de.sluit.mediatracker.games.domain.GamePlatformId
import de.sluit.mediatracker.games.domain.PlatformLabel
import de.sluit.mediatracker.games.game
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
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

    @Test
    fun `findSummaries lists every platform with its game count ordered by label`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()
        ExposedGameRepository().insert(game("Celeste", platforms = listOf(Platforms.PC, Platforms.XBOX)))
        ExposedGameRepository().insert(game("Hades", platforms = listOf(Platforms.XBOX)))

        val summaries = repo.findSummaries()

        assertEquals(
            listOf("Nintendo" to 0, "PC" to 1, "PlayStation" to 0, "Xbox" to 2),
            summaries.map { it.platform.label.value to it.gameCount },
        )
    }

    @Test
    fun `findSummaries is a single query`() = withFreshDatabase { db ->
        val repo = ExposedGamePlatformRepository()

        val count = countStatements(db.database) { repo.findSummaries() }

        assertEquals(1, count)
    }

    @Test
    fun `create inserts a platform`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val outcome = repo.create(PlatformLabel("Switch 2"), HexColor("FF00FF"))

        val created = assertIs<CreateOutcome.Created<GamePlatform>>(outcome).entry
        assertEquals(PlatformLabel("Switch 2"), created.label)
        assertEquals(HexColor("FF00FF"), created.color)
        assertEquals(created, repo.findByIds(setOf(created.id)).single())
    }

    @Test
    fun `create with a taken label is taken whatever the case or accents`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()
        val cafe = (repo.create(PlatformLabel("Café"), HexColor("111111")) as CreateOutcome.Created).entry

        assertEquals(CreateOutcome.Taken(Platforms.XBOX), repo.create(PlatformLabel("xbox"), HexColor("000000")))
        assertEquals(CreateOutcome.Taken(cafe), repo.create(PlatformLabel("CAFE"), HexColor("000000")))
        assertEquals(5, repo.findAll().size)
    }

    @Test
    fun `create reports taken when a competing insert of the label commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()
        var winnerId: String? = null

        val outcome = repo.create(PlatformLabel("Switch 2"), HexColor("FF00FF")) {
            val thread = Thread {
                transaction {
                    winnerId = Uuid.random().toString()
                    GamePlatformsTable.insert {
                        it[id] = winnerId
                        it[label] = "Switch 2"
                        it[associatedColor] = "00FF00"
                    }
                }
            }
            thread.start()
            thread.join()
        }

        val existing = assertIs<CreateOutcome.Taken<GamePlatform>>(outcome).existing
        assertEquals(winnerId, existing.id.toString())
        assertEquals(HexColor("00FF00"), existing.color)
    }

    @Test
    fun `update changes the label only`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val outcome = repo.update(Platforms.XBOX.id, PlatformLabel("Series X"), null)

        assertEquals(RenameOutcome.Renamed(Platforms.XBOX.copy(label = PlatformLabel("Series X"))), outcome)
        assertEquals(Platforms.XBOX.color, repo.findByIds(setOf(Platforms.XBOX.id)).single().color)
    }

    @Test
    fun `update changes the colour only`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val outcome = repo.update(Platforms.XBOX.id, null, HexColor("ABCDEF"))

        assertEquals(RenameOutcome.Renamed(Platforms.XBOX.copy(color = HexColor("ABCDEF"))), outcome)
        assertEquals(Platforms.XBOX.copy(color = HexColor("ABCDEF")), repo.findByIds(setOf(Platforms.XBOX.id)).single())
    }

    @Test
    fun `update to a differently cased spelling of its own label is a plain update`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val outcome = repo.update(Platforms.XBOX.id, PlatformLabel("XBOX"), null)

        assertIs<RenameOutcome.Renamed<GamePlatform>>(outcome)
        assertEquals("XBOX", repo.findByIds(setOf(Platforms.XBOX.id)).single().label.value)
    }

    @Test
    fun `update onto another platform's label is taken and changes nothing`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        val outcome = repo.update(Platforms.XBOX.id, PlatformLabel("nintendo"), HexColor("ABCDEF"))

        assertEquals(RenameOutcome.Taken(Platforms.NINTENDO), outcome)
        assertEquals(Platforms.XBOX, repo.findByIds(setOf(Platforms.XBOX.id)).single())
    }

    @Test
    fun `update of an unknown platform is not found`() = withFreshDatabase {
        val outcome = ExposedGamePlatformRepository().update(GamePlatformId(Uuid.random()), PlatformLabel("X"), null)

        assertEquals(RenameOutcome.NotFound, outcome)
    }

    @Test
    fun `update reports taken when a competing insert of the label commits mid-transaction`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()
        var winnerId: String? = null

        val outcome = repo.update(Platforms.XBOX.id, PlatformLabel("Switch 2"), null) {
            val thread = Thread {
                transaction {
                    winnerId = Uuid.random().toString()
                    GamePlatformsTable.insert {
                        it[id] = winnerId
                        it[label] = "Switch 2"
                        it[associatedColor] = "00FF00"
                    }
                }
            }
            thread.start()
            thread.join()
        }

        assertEquals(winnerId, assertIs<RenameOutcome.Taken<GamePlatform>>(outcome).existing.id.toString())
        assertEquals(Platforms.XBOX, repo.findByIds(setOf(Platforms.XBOX.id)).single())
    }

    @Test
    fun `delete removes an unused platform`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()

        assertEquals(DeleteOutcome.DELETED, repo.delete(Platforms.PLAYSTATION.id))

        assertEquals(emptyList(), repo.findByIds(setOf(Platforms.PLAYSTATION.id)))
    }

    @Test
    fun `delete keeps a platform that a game uses`() = withFreshDatabase {
        val repo = ExposedGamePlatformRepository()
        ExposedGameRepository().insert(game("Celeste", platforms = listOf(Platforms.PC)))

        assertEquals(DeleteOutcome.IN_USE, repo.delete(Platforms.PC.id))

        assertEquals(listOf(Platforms.PC), repo.findByIds(setOf(Platforms.PC.id)))
    }

    @Test
    fun `delete of an unknown platform is not found`() = withFreshDatabase {
        assertEquals(DeleteOutcome.NOT_FOUND, ExposedGamePlatformRepository().delete(GamePlatformId(Uuid.random())))
    }
}
