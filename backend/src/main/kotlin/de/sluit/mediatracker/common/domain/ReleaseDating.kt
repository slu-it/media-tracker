package de.sluit.mediatracker.common.domain

/*
 * The "release date beats release year" rules (MT-025, ADR 0029) shared by every media kind that stores both:
 * a date, when present, decides the year, so the two never disagree.
 */

/** Rejects a [date] whose year differs from [year]; no-op without a date. */
fun requireReleaseYearMatches(year: ReleaseYear, date: ReleaseDate?) {
    if (date != null) {
        requireValid(ReleaseDate.FIELD, year.value == date.year) { "year must match releaseYear when set" }
    }
}

/** The year to store for a requested [year] and optional [date]: the date's year wins over a contradicting year. */
fun effectiveReleaseYear(year: ReleaseYear, date: ReleaseDate?): ReleaseYear =
    date?.let { ReleaseYear(it.year) } ?: year

/**
 * The year after a patch. [resolvedDate] is the date present after the patch (just set, or already there and
 * left unchanged) and always wins; only without one does a given [patchYear] apply, else [currentYear] is kept.
 */
fun resolvePatchedReleaseYear(
    patchYear: ReleaseYear?,
    resolvedDate: ReleaseDate?,
    currentYear: ReleaseYear,
): ReleaseYear = resolvedDate?.let { ReleaseYear(it.year) } ?: (patchYear ?: currentYear)

/** The year of a create request: the requested [year], else the [date]'s year, else a validation error. */
fun releaseYearFromYearOrDate(year: Int?, date: ReleaseDate?): ReleaseYear = year?.let(::ReleaseYear)
    ?: date?.let { ReleaseYear(it.year) }
    ?: throw InvalidValueException(ReleaseYear.FIELD, "is required unless releaseDate is given")
