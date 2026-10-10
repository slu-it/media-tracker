package de.sluit.mediatracker.books.domain

import de.sluit.mediatracker.common.domain.ConflictException
import de.sluit.mediatracker.common.domain.CreateOutcome
import de.sluit.mediatracker.common.domain.DeleteOutcome
import de.sluit.mediatracker.common.domain.HexColor
import de.sluit.mediatracker.common.domain.NameTakenException
import de.sluit.mediatracker.common.domain.NotFoundException
import de.sluit.mediatracker.common.domain.RenameOutcome

/**
 * Business use cases of the editable book types (`/book-types`): the types view, creating, updating and deleting
 * an unused type. [BookService] still lists and resolves types itself.
 */
class BookTypeService(private val types: BookTypeRepository) {
    /** Every type including those without books, with their book count; ordered by label, then id. */
    suspend fun summaries(): List<BookTypeSummary> = types.findSummaries()

    /** A label another type carries (case/accent-insensitively) is a [NameTakenException] naming that type. */
    suspend fun create(label: BookTypeLabel, color: HexColor): BookType =
        when (val outcome = types.create(label, color)) {
            is CreateOutcome.Created -> outcome.entry
            is CreateOutcome.Taken -> throw taken(outcome.existing)
        }

    /** `null` keeps a field. Unknown id is a [NotFoundException], a taken label a [NameTakenException]. */
    suspend fun update(id: BookTypeId, label: BookTypeLabel?, color: HexColor?): BookType =
        when (val outcome = types.update(id, label, color)) {
            is RenameOutcome.Renamed -> outcome.entry
            RenameOutcome.NotFound -> throw NotFoundException(RESOURCE, id.toString())
            is RenameOutcome.Taken -> throw taken(outcome.existing)
        }

    /** Deletes an unused type; unknown id is a [NotFoundException], one still linked to a book a [ConflictException]. */
    suspend fun delete(id: BookTypeId) {
        when (types.delete(id)) {
            DeleteOutcome.DELETED -> Unit
            DeleteOutcome.NOT_FOUND -> throw NotFoundException(RESOURCE, id.toString())
            DeleteOutcome.IN_USE -> throw ConflictException(RESOURCE, id.toString())
        }
    }

    private fun taken(existing: BookType) = NameTakenException(RESOURCE, existing.id.toString(), existing.label.value)

    private companion object {
        const val RESOURCE = "book type"
    }
}
