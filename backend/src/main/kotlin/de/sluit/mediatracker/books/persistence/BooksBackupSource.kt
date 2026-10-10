package de.sluit.mediatracker.books.persistence

import de.sluit.mediatracker.books.domain.BookTypeLabel
import de.sluit.mediatracker.common.persistence.EditableVocabulary
import de.sluit.mediatracker.common.persistence.ExposedBackupSource

/**
 * [de.sluit.mediatracker.common.domain.BackupSource] for every table the books domain owns (ADR 0027, 0034).
 * Parents before the tables that reference them: types and books before the book-to-type junction, authors
 * before the book-to-author junction, and likewise narrators and series.
 */
object BooksBackupSource : ExposedBackupSource(
    listOf(
        BookTypesTable,
        BooksTable,
        BookToTypeTable,
        BookAuthorsTable,
        BookToAuthorTable,
        BookNarratorsTable,
        BookToNarratorTable,
        BookSeriesTable,
        BookToSeriesTable,
    ),
    // Editable: a restored dump carries the types' current labels and colours.
    updatableTables = mapOf(
        BookTypesTable to EditableVocabulary(BookTypesTable.label, BookTypesTable.associatedColor) {
            BookTypeLabel(it)
        },
    ),
)
