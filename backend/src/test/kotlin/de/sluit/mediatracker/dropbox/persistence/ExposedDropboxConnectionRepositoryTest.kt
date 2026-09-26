package de.sluit.mediatracker.dropbox.persistence

import de.sluit.mediatracker.common.persistence.withFreshDatabase
import de.sluit.mediatracker.dropbox.domain.RefreshToken
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.Clock
import kotlin.time.Instant

private fun now(): Instant = Clock.System.now().let {
    Instant.fromEpochSeconds(it.epochSeconds, (it.nanosecondsOfSecond / 1_000) * 1_000)
}

class ExposedDropboxConnectionRepositoryTest {

    @Test
    fun `find of an unconfigured connection returns null`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()

        assertNull(repo.find())
    }

    @Test
    fun `save then find returns the stored refresh token and connection time`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()
        val connectedAt = now()

        repo.save(RefreshToken("refresh-1"), connectedAt)
        val found = repo.find()

        assertEquals(RefreshToken("refresh-1"), found?.refreshToken)
        assertEquals(connectedAt, found?.connectedAt)
    }

    @Test
    fun `save upserts the single dropbox row rather than inserting a second one`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()
        repo.save(RefreshToken("refresh-1"), now())

        val secondConnectedAt = now()
        repo.save(RefreshToken("refresh-2"), secondConnectedAt)

        val found = repo.find()
        assertEquals(RefreshToken("refresh-2"), found?.refreshToken)
        assertEquals(secondConnectedAt, found?.connectedAt)
    }

    @Test
    fun `delete removes the stored connection`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()
        repo.save(RefreshToken("refresh-1"), now())

        repo.delete()

        assertNull(repo.find())
    }

    @Test
    fun `delete of no stored connection is a no-op`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()

        repo.delete()

        assertNull(repo.find())
    }

    @Test
    fun `deleteIfRefreshTokenMatches removes the connection when the token still matches`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()
        repo.save(RefreshToken("refresh-1"), now())

        repo.deleteIfRefreshTokenMatches(RefreshToken("refresh-1"))

        assertNull(repo.find())
    }

    @Test
    fun `deleteIfRefreshTokenMatches is a no-op when the stored token has since changed`() = withFreshDatabase {
        val repo = ExposedDropboxConnectionRepository()
        repo.save(RefreshToken("refresh-1"), now())
        val reconnectedAt = now()
        repo.save(RefreshToken("refresh-2"), reconnectedAt)

        // Simulates a reconnect that raced with a refresh call for the now-stale "refresh-1": it must survive.
        repo.deleteIfRefreshTokenMatches(RefreshToken("refresh-1"))

        val found = repo.find()
        assertEquals(RefreshToken("refresh-2"), found?.refreshToken)
        assertEquals(reconnectedAt, found?.connectedAt)
    }
}
