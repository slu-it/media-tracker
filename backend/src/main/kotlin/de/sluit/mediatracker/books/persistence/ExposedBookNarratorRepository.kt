package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookNarrator
import de.sluit.mediatracker.books.domain.BookNarratorId
import de.sluit.mediatracker.books.domain.BookNarratorRepository
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.VocabularyCreation
import de.sluit.mediatracker.common.domain.VocabularyName
import de.sluit.mediatracker.common.domain.VocabularySearchLimit
import de.sluit.mediatracker.common.persistence.ExposedNameVocabulary
import kotlin.uuid.Uuid

/**
 * [BookNarratorRepository] on Exposed/JDBC: a vocabulary the user grows on the fly, unlike the seeded
 * [BookTypesTable]. Its `name` column carries the `uq_book_narrators_name` unique index. The search, lookup and
 * race-safe create logic lives in [ExposedNameVocabulary]; this class only binds it to [BookNarratorsTable] and
 * the [BookNarrator] entity.
 */
class ExposedBookNarratorRepository : BookNarratorRepository {
    private val vocabulary = ExposedNameVocabulary(
        table = BookNarratorsTable,
        id = BookNarratorsTable.id,
        name = BookNarratorsTable.name,
        toEntity = { id, name -> BookNarrator(BookNarratorId(Uuid.parseHexDash(id)), name) },
    )

    override suspend fun search(term: SearchTerm?, limit: VocabularySearchLimit): List<BookNarrator> =
        vocabulary.search(term, limit)

    override suspend fun findByIds(ids: Set<BookNarratorId>): List<BookNarrator> =
        vocabulary.findByIds(ids.map { it.toString() }.toSet())

    override suspend fun create(name: VocabularyName): VocabularyCreation<BookNarrator> = vocabulary.create(name)

    /** Test seam, see [ExposedNameVocabulary.create]. */
    internal suspend fun create(
        name: VocabularyName,
        afterInitialLookup: () -> Unit,
    ): VocabularyCreation<BookNarrator> = vocabulary.create(name, afterInitialLookup)
}
