package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.common.domain.InvalidValueException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * Unit tests for [JsonBackupCodec]'s `Any?` <-> JSON value mapping, pinned once here instead of in every handler
 * test that exercises `/api/backup`. The HTTP wiring (content type, status codes) lives in
 * `de.sluit.mediatracker.backup.api.BackupRoutesTest`.
 */
class JsonBackupCodecTest {
    private val codec = JsonBackupCodec()

    @Test
    fun `encode renders every supported value type and keeps table and row order`() {
        val snapshot = linkedMapOf(
            "games" to
                listOf(
                    linkedMapOf<String, Any?>(
                        "id" to "1",
                        "release_year" to 2018L,
                        "rating" to 4.5,
                        "hidden" to true,
                        "description" to null,
                    ),
                ),
        )

        val json = codec.encode(snapshot).toString(Charsets.UTF_8)

        assertEquals(
            """{"games":[{"id":"1","release_year":2018,"rating":4.5,"hidden":true,"description":null}]}""",
            json,
        )
    }

    @Test
    fun `decode round-trips every supported value type back into a BackupRow`() {
        val json = Json.parseToJsonElement(
            """{"games":[{"id":"1","release_year":2018,"rating":4.5,"hidden":true,"description":null}]}""",
        ) as JsonObject

        val tables = codec.decode(json)

        val row = tables.getValue("games").single()
        assertEquals("1", row["id"])
        assertEquals(2018L, row["release_year"])
        assertEquals(4.5, row["rating"])
        assertEquals(true, row["hidden"])
        assertEquals(null, row["description"])
    }

    @Test
    fun `decode rejects a table value that is not an array`() {
        val json = Json.parseToJsonElement("""{"games":{}}""") as JsonObject

        assertFailsWith<InvalidValueException> { codec.decode(json) }
    }

    @Test
    fun `decode rejects a row that is not an object`() {
        val json = Json.parseToJsonElement("""{"games":["not an object"]}""") as JsonObject

        assertFailsWith<InvalidValueException> { codec.decode(json) }
    }

    @Test
    fun `decode rejects a row value that is not a json primitive`() {
        val json = Json.parseToJsonElement("""{"games":[{"tags":["a","b"]}]}""") as JsonObject

        assertFailsWith<InvalidValueException> { codec.decode(json) }
    }
}
