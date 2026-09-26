package de.sluit.mediatracker.dropbox.persistence

import de.sluit.mediatracker.common.persistence.dbQuery
import de.sluit.mediatracker.dropbox.domain.DropboxConnection
import de.sluit.mediatracker.dropbox.domain.DropboxConnectionRepository
import de.sluit.mediatracker.dropbox.domain.RefreshToken
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import kotlin.time.Instant

private const val PROVIDER = "dropbox"

/** [DropboxConnectionRepository] over the generic [OAuthConnectionsTable], fixed to the `"dropbox"` provider row. */
class ExposedDropboxConnectionRepository : DropboxConnectionRepository {
    override suspend fun find(): DropboxConnection? = dbQuery {
        OAuthConnectionsTable.selectAll()
            .where { OAuthConnectionsTable.provider eq PROVIDER }
            .singleOrNull()
            ?.let {
                DropboxConnection(
                    refreshToken = RefreshToken(it[OAuthConnectionsTable.refreshToken]),
                    connectedAt = it[OAuthConnectionsTable.connectedAt],
                )
            }
    }

    override suspend fun save(refreshToken: RefreshToken, connectedAt: Instant) {
        dbQuery {
            val updated = OAuthConnectionsTable.update({ OAuthConnectionsTable.provider eq PROVIDER }) {
                it[OAuthConnectionsTable.refreshToken] = refreshToken.value
                it[OAuthConnectionsTable.connectedAt] = connectedAt
            }
            if (updated == 0) {
                OAuthConnectionsTable.insert {
                    it[provider] = PROVIDER
                    it[OAuthConnectionsTable.refreshToken] = refreshToken.value
                    it[OAuthConnectionsTable.connectedAt] = connectedAt
                }
            }
        }
    }

    override suspend fun delete() {
        dbQuery {
            OAuthConnectionsTable.deleteWhere { OAuthConnectionsTable.provider eq PROVIDER }
        }
    }

    override suspend fun deleteIfRefreshTokenMatches(refreshToken: RefreshToken) {
        dbQuery {
            OAuthConnectionsTable.deleteWhere {
                (OAuthConnectionsTable.provider eq PROVIDER) and
                    (OAuthConnectionsTable.refreshToken eq refreshToken.value)
            }
        }
    }
}
