package de.sluit.mediatracker.auth.api

import de.sluit.mediatracker.auth.domain.SessionRepository
import io.ktor.server.sessions.SessionStorage
import kotlinx.serialization.json.Json
import kotlin.time.Clock
import kotlin.time.Duration

/**
 * Ktor [SessionStorage] backed by the `sessions` table.
 *
 * Ktor hands us the serialized [UserSession] as `value`; we persist only the user id and rebuild the
 * value from the joined user row on read, so the table holds (id, user_id, expires_at) and nothing else.
 * Per the Ktor contract, [read] throws [NoSuchElementException] for unknown or expired ids.
 */
class DbSessionStorage(
    private val sessions: SessionRepository,
    private val maxAge: Duration,
    private val json: Json = Json,
) : SessionStorage {

    override suspend fun write(id: String, value: String) {
        val session = json.decodeFromString<UserSession>(value)
        sessions.save(id, session.userId, Clock.System.now() + maxAge)
    }

    override suspend fun read(id: String): String {
        val stored = sessions.find(id) ?: throw NoSuchElementException("Session $id not found")
        if (stored.expiresAt <= Clock.System.now()) {
            sessions.delete(id)
            throw NoSuchElementException("Session $id expired")
        }
        return json.encodeToString(UserSession(stored.userId, stored.username))
    }

    override suspend fun invalidate(id: String) {
        sessions.delete(id)
    }
}
