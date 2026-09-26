package de.sluit.mediatracker.dropbox.persistence

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.datetime.timestamp

/**
 * OAuth connections to outward providers (MT-024, ADR 0028); one row per provider, e.g. "dropbox". A system
 * table like `users`/`sessions`: never exported, see `backup/BackupCoverageTest`.
 */
object OAuthConnectionsTable : Table("oauth_connections") {
    val provider = varchar("provider", 32)
    val refreshToken = varchar("refresh_token", 512)
    val connectedAt = timestamp("connected_at")

    override val primaryKey = PrimaryKey(provider)
}
