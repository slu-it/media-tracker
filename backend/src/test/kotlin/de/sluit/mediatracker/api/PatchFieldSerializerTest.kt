package de.sluit.mediatracker.api

import de.sluit.mediatracker.games.api.UpdateGameRequest
import de.sluit.mediatracker.testJson
import kotlin.test.Test
import kotlin.test.assertEquals

class PatchFieldSerializerTest {
    @Test
    fun `absent key decodes to Absent`() {
        val request = testJson.decodeFromString<UpdateGameRequest>("""{"title":"x"}""")
        assertEquals(PatchField.Absent, request.coverImageUrl)
    }

    @Test
    fun `explicit null decodes to Present(null)`() {
        val request = testJson.decodeFromString<UpdateGameRequest>("""{"coverImageUrl":null}""")
        assertEquals(PatchField.Present(null), request.coverImageUrl)
    }

    @Test
    fun `value decodes to Present(value)`() {
        val request = testJson.decodeFromString<UpdateGameRequest>("""{"coverImageUrl":"https://x/y.png"}""")
        assertEquals(PatchField.Present("https://x/y.png"), request.coverImageUrl)
    }

    @Test
    fun `a PatchField of Double decodes the same way`() {
        assertEquals(PatchField.Absent, testJson.decodeFromString<UpdateGameRequest>("""{"title":"x"}""").rating)
        assertEquals(
            PatchField.Present(null),
            testJson.decodeFromString<UpdateGameRequest>("""{"rating":null}""").rating,
        )
        assertEquals(
            PatchField.Present(4.5),
            testJson.decodeFromString<UpdateGameRequest>("""{"rating":4.5}""").rating,
        )
    }
}
