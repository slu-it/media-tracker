package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.CoverImageUrl
import de.sluit.mediatracker.common.domain.Description
import de.sluit.mediatracker.common.domain.PageSize
import de.sluit.mediatracker.common.domain.ReleaseDate
import de.sluit.mediatracker.common.domain.ReleaseYear
import de.sluit.mediatracker.common.domain.SearchTerm
import de.sluit.mediatracker.common.domain.Title
import de.sluit.mediatracker.common.domain.WireEnum
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.add
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/*
 * JSON-schema property fragments of the MCP tool input schemas that are identical for every media kind. Each
 * helper adds one property to the schema's `properties` object; kind-specific wording comes in as the
 * description. The value-class constants keep the schemas from drifting from the domain rules.
 */

/** `type` is `[<type>, "null"]` instead of `<type>` when the property can be cleared by passing null. */
private fun JsonObjectBuilder.putType(type: String, clearable: Boolean) {
    if (clearable) {
        putJsonArray("type") {
            add(type)
            add("null")
        }
    } else {
        put("type", type)
    }
}

internal fun JsonObjectBuilder.putTitleProperty(description: String, maxLength: Int = Title.MAX_LENGTH) {
    putJsonObject(Title.FIELD) {
        put("type", "string")
        put("description", description)
        put("minLength", 1)
        put("maxLength", maxLength)
    }
}

internal fun JsonObjectBuilder.putReleaseYearProperty(description: String) {
    putJsonObject(ReleaseYear.FIELD) {
        put("type", "integer")
        put("description", description)
        put("minimum", ReleaseYear.MIN)
        put("maximum", ReleaseYear.MAX)
    }
}

internal fun JsonObjectBuilder.putReleaseDateProperty(description: String, clearable: Boolean = false) {
    putJsonObject(ReleaseDate.FIELD) {
        putType("string", clearable)
        put("format", "date")
        put("description", description)
    }
}

internal fun JsonObjectBuilder.putDescriptionProperty(description: String, clearable: Boolean = false) {
    putJsonObject(Description.FIELD) {
        putType("string", clearable)
        put("description", description)
        put("minLength", 1)
        put("maxLength", Description.MAX_LENGTH)
    }
}

internal fun JsonObjectBuilder.putCoverImageUrlProperty(description: String, clearable: Boolean = false) {
    putJsonObject(CoverImageUrl.FIELD) {
        putType("string", clearable)
        put("description", description)
        put("minLength", 1)
        put("maxLength", CoverImageUrl.MAX_LENGTH)
        put("format", "uri")
    }
}

/** An array of unique uuids, e.g. a vocabulary's or a platform list's ids. */
internal fun JsonObjectBuilder.putUuidArrayProperty(
    name: String,
    description: String,
    minItems: Int? = null,
    maxItems: Int? = null,
) {
    putJsonObject(name) {
        put("type", "array")
        put("description", description)
        putJsonObject("items") {
            put("type", "string")
            put("format", "uuid")
        }
        if (minItems != null) put("minItems", minItems)
        put("uniqueItems", true)
        if (maxItems != null) put("maxItems", maxItems)
    }
}

/** A string property restricted to the wire values of [entries] (pass `Enum.entries`). */
internal fun JsonObjectBuilder.putEnumProperty(name: String, entries: Iterable<WireEnum>, description: String) {
    putJsonObject(name) {
        put("type", "string")
        putJsonArray("enum") { entries.forEach { add(it.wire) } }
        put("description", description)
    }
}

/** A filter array of unique wire values of [entries]; at most [maxItems] of them. */
internal fun JsonObjectBuilder.putEnumArrayProperty(
    name: String,
    entries: Iterable<WireEnum>,
    description: String,
    maxItems: Int = MAX_FILTER_VALUES,
) {
    putJsonObject(name) {
        put("type", "array")
        put("description", description)
        putJsonObject("items") {
            put("type", "string")
            putJsonArray("enum") { entries.forEach { add(it.wire) } }
        }
        put("uniqueItems", true)
        put("maxItems", maxItems)
    }
}

internal fun JsonObjectBuilder.putReleaseYearsFilterProperty(description: String) {
    putJsonObject("releaseYears") {
        put("type", "array")
        put("description", description)
        putJsonObject("items") {
            put("type", "integer")
            put("minimum", ReleaseYear.MIN)
            put("maximum", ReleaseYear.MAX)
        }
        put("uniqueItems", true)
        put("maxItems", MAX_FILTER_VALUES)
    }
}

/** The free-text `query` argument; [minLength] 1 where an empty query is meaningless, absent where it is allowed. */
internal fun JsonObjectBuilder.putQueryProperty(description: String, minLength: Int? = 1) {
    putJsonObject("query") {
        put("type", "string")
        put("description", description)
        if (minLength != null) put("minLength", minLength)
        put("maxLength", SearchTerm.MAX_LENGTH)
    }
}

internal fun JsonObjectBuilder.putPageSizeProperty(description: String, max: Int, default: Int) {
    putJsonObject(PageSize.FIELD) {
        put("type", "integer")
        put("description", description)
        put("minimum", 1)
        put("maximum", max)
        put("default", default)
    }
}
