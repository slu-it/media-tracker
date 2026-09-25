package de.sluit.mediatracker.backup.domain

import de.sluit.mediatracker.common.domain.BackupRow
import de.sluit.mediatracker.common.domain.BackupSource
import de.sluit.mediatracker.common.domain.InvalidValueException
import de.sluit.mediatracker.common.domain.TableImportResult

/**
 * Merges every domain's [BackupSource] into one JSON-shaped export/import (MT-023, ADR 0027: step 1 of
 * backups). Framework-free by design; converting to/from JSON lives in
 * [de.sluit.mediatracker.backup.api.backupRoutes]. Wired in `Application.module()` from
 * [de.sluit.mediatracker.backupSources], the same list [de.sluit.mediatracker.backup.BackupCoverageTest] checks
 * against `allTables`.
 */
class BackupService(private val sources: List<BackupSource>) {
    init {
        val duplicates = sources.flatMap { it.tableNames }.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        require(duplicates.isEmpty()) { "duplicate backup table name(s) across sources: ${duplicates.sorted()}" }
    }

    private val tableNames: Set<String> = sources.flatMap { it.tableNames }.toSet()

    /** Every table, merged in source order; a [LinkedHashMap] keeps that order in the JSON [backupRoutes] write. */
    suspend fun export(): Map<String, List<BackupRow>> {
        val merged = LinkedHashMap<String, List<BackupRow>>()
        sources.forEach { source -> merged.putAll(source.export()) }
        return merged
    }

    /**
     * Rejects any table name [tables] holds that no wired source owns, before writing anything, then validates
     * every source's own slice of [tables] (a table name a source owns that [tables] omits is passed as empty,
     * so a dump from before a newer table existed still imports) before importing any of them: a later source
     * failing validation must leave every earlier source untouched too.
     */
    suspend fun import(tables: Map<String, List<BackupRow>>): Map<String, TableImportResult> {
        val unknown = tables.keys - tableNames
        if (unknown.isNotEmpty()) {
            throw InvalidValueException("tables", "unknown table(s): ${unknown.sorted()}")
        }
        val slices = sources.map { source -> source to source.tableNames.associateWith { tables[it].orEmpty() } }
        slices.forEach { (source, slice) -> source.validate(slice) }
        val merged = LinkedHashMap<String, TableImportResult>()
        slices.forEach { (source, slice) -> merged.putAll(source.import(slice)) }
        return merged
    }
}
