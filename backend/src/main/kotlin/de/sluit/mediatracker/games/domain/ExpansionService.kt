package de.sluit.mediatracker.games.domain

import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.NotFoundException

/**
 * Business use cases for game expansions (MT-016, ADR 0023). The sole owner of the sequence invariant: one
 * game's expansions are numbered densely and zero-based (0..n-1), ordered ascending by [SequenceNumber]; every
 * mutation that could break density (create, move, delete) renumbers before returning.
 */
class ExpansionService(private val games: GameRepository, private val expansions: ExpansionRepository) {
    suspend fun list(gameId: GameId): List<Expansion> {
        ensureGameExists(gameId)
        return expansions.findByGame(gameId)
    }

    /** Appends the new expansion at the end of the game's current order. */
    suspend fun create(gameId: GameId, new: NewExpansion): Expansion {
        ensureGameExists(gameId)
        val expansion = Expansion(
            id = ExpansionId.new(),
            gameId = gameId,
            sequence = SequenceNumber(expansions.findByGame(gameId).size),
            title = new.title,
            ownership = new.ownership,
            progress = new.progress,
        )
        expansions.insert(expansion)
        return expansion
    }

    /**
     * Load, apply, save, like [GameService.update]. A non-null [ExpansionPatch.sequence] is a move: the target
     * index must fall inside the game's current range, the expansion is pulled out of the ordered list and
     * reinserted at that index, and the whole order is persisted in one call so it never observes a gap.
     */
    suspend fun update(gameId: GameId, id: ExpansionId, patch: ExpansionPatch): Expansion {
        ensureGameExists(gameId)
        val current = expansions.findByGameAndId(gameId, id) ?: throw NotFoundException(RESOURCE, id.toString())
        // Only a move reads the current order, and it is validated before anything is written: a bad target
        // index must not leave the other fields half-applied.
        val move = patch.sequence?.value?.let { target ->
            val ordered = expansions.findByGame(gameId).map { it.id }
            if (target !in ordered.indices) {
                throw InvalidValueException(SequenceNumber.FIELD, "must be between 0 and ${ordered.size - 1}")
            }
            ordered.toMutableList().apply {
                remove(id)
                add(target, id)
            } to target
        }

        val updated = patch.applyTo(current)
        if (!expansions.update(updated)) throw NotFoundException(RESOURCE, id.toString())
        val (reordered, targetIndex) = move ?: return updated

        expansions.saveOrder(gameId, reordered)
        return updated.copy(sequence = SequenceNumber(targetIndex))
    }

    /** Idempotent like [GameService.delete]: deleting an unknown (or already-deleted) id is not an error. */
    suspend fun delete(gameId: GameId, id: ExpansionId) {
        val current = expansions.findByGameAndId(gameId, id) ?: return
        if (expansions.deleteById(current.id) > 0) {
            val remaining = expansions.findByGame(gameId).map { it.id }
            expansions.saveOrder(gameId, remaining)
        }
    }

    private suspend fun ensureGameExists(gameId: GameId) {
        if (!games.exists(gameId)) throw NotFoundException(GameService.RESOURCE, gameId.toString())
    }

    companion object {
        const val RESOURCE = "expansion"
    }
}
