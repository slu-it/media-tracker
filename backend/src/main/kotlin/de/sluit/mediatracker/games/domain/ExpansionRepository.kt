package de.sluit.mediatracker.games.domain

/**
 * Persistence port of the game expansions domain. Implemented in `games.persistence`; the domain never imports
 * that package, so dependencies point inward only.
 */
interface ExpansionRepository {
    /** The game's expansions, ordered by sequence, then id. */
    suspend fun findByGame(gameId: GameId): List<Expansion>

    /** `null` when no expansion with [id] exists for [gameId], including when it belongs to a different game. */
    suspend fun findByGameAndId(gameId: GameId, id: ExpansionId): Expansion?

    suspend fun insert(expansion: Expansion)

    /** @return false when no row with the expansion's id exists (anymore). */
    suspend fun update(expansion: Expansion): Boolean

    /** @return number of deleted rows (0 or 1). */
    suspend fun deleteById(id: ExpansionId): Int

    /** Rewrites the sequence numbers of the given game's expansions to 0..n-1 in the order given, in one transaction. */
    suspend fun saveOrder(gameId: GameId, orderedIds: List<ExpansionId>)
}
