package de.sluit.mediatracker.dropbox.domain

import de.sluit.mediatracker.common.domain.ExternalSourceException
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.StoredFile
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

/** A [Clock] whose [now] is set explicitly, so token-expiry math is deterministic. */
private class FixedClock(private var instant: Instant) : Clock {
    override fun now(): Instant = instant

    fun advanceBy(duration: Duration) {
        instant += duration
    }
}

class DropboxServiceTest {
    private val api = mockk<DropboxApi>()
    private val connections = mockk<DropboxConnectionRepository>()
    private val clock = FixedClock(Instant.parse("2024-01-01T00:00:00Z"))
    private val backend = DropboxService.Backend(api, "app-key")
    private val service = DropboxService(backend, connections, clock)

    private val refreshToken = RefreshToken("refresh-token-value")
    private val connection = DropboxConnection(refreshToken, clock.now())

    // ---- availability ----

    @Test
    fun `available is false without a backend`() {
        val unconfigured = DropboxService(null, connections, clock)

        assertFalse(unconfigured.available)
    }

    @Test
    fun `available is true with a backend`() {
        assertTrue(service.available)
    }

    @Test
    fun `authorizeUrl embeds the app key and asks for an offline code`() {
        val url = service.authorizeUrl()

        assertEquals(
            "https://www.dropbox.com/oauth2/authorize?client_id=app-key&response_type=code&token_access_type=offline",
            url,
        )
    }

    @Test
    fun `authorizeUrl without a backend throws external source unavailable`() {
        val unconfigured = DropboxService(null, connections, clock)

        val exception = assertFailsWith<ExternalSourceUnavailableException> { unconfigured.authorizeUrl() }

        assertEquals(DROPBOX_SOURCE, exception.source)
    }

    // ---- isConnected ----

    @Test
    fun `isConnected is false without a backend and does not touch the repository`() = runBlocking {
        val unconfigured = DropboxService(null, connections, clock)

        val connected = unconfigured.isConnected()

        assertFalse(connected)
        coVerify(exactly = 0) { connections.find() }
    }

    @Test
    fun `isConnected is false with a backend but no stored connection`() = runBlocking {
        coEvery { connections.find() } returns null

        val connected = service.isConnected()

        assertFalse(connected)
    }

    @Test
    fun `isConnected is true with a backend and a stored connection`() = runBlocking {
        coEvery { connections.find() } returns connection

        val connected = service.isConnected()

        assertTrue(connected)
    }

    // ---- status ----

    @Test
    fun `status reports connected with the stored connection time`() = runBlocking {
        coEvery { connections.find() } returns connection

        val status = service.status()

        assertTrue(status.available)
        assertTrue(status.connected)
        assertEquals(connection.connectedAt, status.connectedAt)
    }

    @Test
    fun `status reports not connected when no connection is stored`() = runBlocking {
        coEvery { connections.find() } returns null

        val status = service.status()

        assertFalse(status.connected)
        assertNull(status.connectedAt)
    }

    // ---- connect ----

    @Test
    fun `connect stores the refresh token and the connection time`() = runBlocking {
        coEvery { api.exchangeCode(AuthorizationCode("pasted-code")) } returns
            ExchangeGrant("access-1", refreshToken, 4.hours)
        coEvery { connections.save(refreshToken, clock.now()) } returns Unit
        coEvery { connections.find() } returns connection

        service.connect(AuthorizationCode("pasted-code"))

        coVerify { connections.save(refreshToken, clock.now()) }
    }

    @Test
    fun `connect caches the access token so the next upload does not need a refresh`() = runBlocking {
        coEvery { api.exchangeCode(AuthorizationCode("pasted-code")) } returns
            ExchangeGrant("access-1", refreshToken, 4.hours)
        coEvery { connections.save(refreshToken, clock.now()) } returns Unit
        coEvery { connections.find() } returns connection
        coEvery { api.upload("access-1", "/backup/full-export.json", byteArrayOf(1)) } returns
            StoredFile("/backup/full-export.json", clock.now(), 1)

        service.connect(AuthorizationCode("pasted-code"))
        service.upload("/backup/full-export.json", byteArrayOf(1))

        // status() (called by connect() to build its return value) is the only find(); upload reuses the
        // access token connect() already cached instead of asking the repository again.
        coVerify(exactly = 1) { connections.find() }
        coVerify(exactly = 0) { api.refresh(any()) }
    }

    @Test
    fun `connect on a rejected code throws InvalidValueException naming the code field`() = runBlocking {
        coEvery { api.exchangeCode(AuthorizationCode("bad-code")) } throws
            DropboxInvalidGrantException("dropbox says no")

        val exception = assertFailsWith<InvalidValueException> {
            service.connect(AuthorizationCode("bad-code"))
        }

        assertEquals(AuthorizationCode.FIELD, exception.field)
        coVerify(exactly = 0) { connections.save(any(), any()) }
    }

    @Test
    fun `connect without a backend throws external source unavailable`() = runBlocking {
        val unconfigured = DropboxService(null, connections, clock)

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            unconfigured.connect(AuthorizationCode("pasted-code"))
        }

        assertEquals(DROPBOX_SOURCE, exception.source)
    }

    // ---- disconnect ----

    @Test
    fun `disconnect revokes the access token and deletes the connection`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returns AccessGrant("access-1", 4.hours)
        coEvery { api.revoke("access-1") } returns Unit
        coEvery { connections.delete() } returns Unit

        service.disconnect()

        coVerify { api.revoke("access-1") }
        coVerify { connections.delete() }
    }

    @Test
    fun `disconnect without a stored connection skips revoke but still deletes`() = runBlocking {
        coEvery { connections.find() } returns null
        coEvery { connections.delete() } returns Unit

        service.disconnect()

        coVerify(exactly = 0) { api.revoke(any()) }
        coVerify { connections.delete() }
    }

    @Test
    fun `disconnect deletes the connection even when revoke fails`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returns AccessGrant("access-1", 4.hours)
        coEvery { api.revoke("access-1") } throws ExternalSourceException(DROPBOX_SOURCE, "boom")
        coEvery { connections.delete() } returns Unit

        service.disconnect()

        coVerify { connections.delete() }
    }

    // ---- access token caching and refresh ----

    @Test
    fun `upload refreshes the access token when nothing is cached yet`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returns AccessGrant("access-1", 4.hours)
        coEvery { api.upload("access-1", "/backup/full-export.json", byteArrayOf(1)) } returns
            StoredFile("/backup/full-export.json", clock.now(), 1)

        service.upload("/backup/full-export.json", byteArrayOf(1))

        coVerify(exactly = 1) { api.refresh(refreshToken) }
    }

    @Test
    fun `a cached access token is reused for a second call within its lifetime`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returns AccessGrant("access-1", 4.hours)
        coEvery { api.upload("access-1", "/backup/full-export.json", any()) } returns
            StoredFile("/backup/full-export.json", clock.now(), 1)

        service.upload("/backup/full-export.json", byteArrayOf(1))
        clock.advanceBy(1.hours)
        service.upload("/backup/full-export.json", byteArrayOf(2))

        coVerify(exactly = 1) { api.refresh(refreshToken) }
    }

    @Test
    fun `the access token is refreshed again 5 minutes before it would expire`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returnsMany listOf(
            AccessGrant("access-1", 4.hours),
            AccessGrant("access-2", 4.hours),
        )
        coEvery { api.upload(any(), "/backup/full-export.json", any()) } returns
            StoredFile("/backup/full-export.json", clock.now(), 1)

        service.upload("/backup/full-export.json", byteArrayOf(1))
        clock.advanceBy(4.hours - 4.minutes)
        service.upload("/backup/full-export.json", byteArrayOf(2))

        coVerify(exactly = 2) { api.refresh(refreshToken) }
        coVerify { api.upload("access-2", "/backup/full-export.json", byteArrayOf(2)) }
    }

    @Test
    fun `find retries once after a 401 forces a refresh`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returnsMany listOf(
            AccessGrant("stale-access", 4.hours),
            AccessGrant("fresh-access", 4.hours),
        )
        coEvery { api.getMetadata("stale-access", "/backup/full-export.json") } throws
            DropboxUnauthorizedException("expired")
        coEvery { api.getMetadata("fresh-access", "/backup/full-export.json") } returns
            StoredFile("/backup/full-export.json", clock.now(), 42)

        val result = service.find("/backup/full-export.json")

        assertEquals(42L, result?.sizeBytes)
        coVerify(exactly = 2) { api.refresh(refreshToken) }
    }

    @Test
    fun `a second 401 after the retry becomes an external source exception`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returns AccessGrant("access-1", 4.hours)
        coEvery { api.getMetadata("access-1", "/backup/full-export.json") } throws
            DropboxUnauthorizedException("still rejected")

        val exception = assertFailsWith<ExternalSourceException> {
            service.find("/backup/full-export.json")
        }

        assertEquals(DROPBOX_SOURCE, exception.source)
    }

    @Test
    fun `invalid_grant on refresh deletes only the connection whose refresh token was actually rejected`() =
        runBlocking {
            coEvery { connections.find() } returns connection
            coEvery { api.refresh(refreshToken) } throws DropboxInvalidGrantException("revoked")
            coEvery { connections.deleteIfRefreshTokenMatches(refreshToken) } returns Unit

            val exception = assertFailsWith<ExternalSourceUnavailableException> {
                service.upload("/backup/full-export.json", byteArrayOf(1))
            }

            assertEquals(DROPBOX_SOURCE, exception.source)
            // The conditional variant, never the blind delete: a reconnect that raced with this refresh must
            // survive.
            coVerify { connections.deleteIfRefreshTokenMatches(refreshToken) }
            coVerify(exactly = 0) { connections.delete() }
        }

    @Test
    fun `invalid_grant on the forced refresh after a 401 answers external source unavailable`() = runBlocking {
        coEvery { connections.find() } returns connection
        coEvery { api.refresh(refreshToken) } returns AccessGrant("stale-access", 4.hours) andThenThrows
            DropboxInvalidGrantException("revoked")
        coEvery { api.upload("stale-access", "/backup/full-export.json", byteArrayOf(1)) } throws
            DropboxUnauthorizedException("expired")
        coEvery { connections.deleteIfRefreshTokenMatches(refreshToken) } returns Unit

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            service.upload("/backup/full-export.json", byteArrayOf(1))
        }

        assertEquals(DROPBOX_SOURCE, exception.source)
        coVerify { connections.deleteIfRefreshTokenMatches(refreshToken) }
    }

    @Test
    fun `disconnect clears the cached access token so a later upload does not reuse it`() = runBlocking {
        coEvery { api.exchangeCode(AuthorizationCode("pasted-code")) } returns
            ExchangeGrant("access-1", refreshToken, 4.hours)
        coEvery { connections.save(refreshToken, clock.now()) } returns Unit
        coEvery { connections.find() } returnsMany listOf(connection, connection, null)
        coEvery { api.revoke("access-1") } returns Unit
        coEvery { connections.delete() } returns Unit

        service.connect(AuthorizationCode("pasted-code"))
        service.disconnect()

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            service.upload("/backup/full-export.json", byteArrayOf(1))
        }

        assertEquals(DROPBOX_SOURCE, exception.source)
        coVerify(exactly = 0) { api.refresh(any()) }
    }

    @Test
    fun `upload without a stored connection answers external source unavailable`() = runBlocking {
        coEvery { connections.find() } returns null

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            service.upload("/backup/full-export.json", byteArrayOf(1))
        }

        assertEquals(DROPBOX_SOURCE, exception.source)
    }

    @Test
    fun `upload without a backend answers external source unavailable without touching the repository`() = runBlocking {
        val unconfigured = DropboxService(null, connections, clock)

        val exception = assertFailsWith<ExternalSourceUnavailableException> {
            unconfigured.upload("/backup/full-export.json", byteArrayOf(1))
        }

        assertEquals(DROPBOX_SOURCE, exception.source)
        coVerify(exactly = 0) { connections.find() }
    }
}
