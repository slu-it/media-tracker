package de.sluit.mediatracker.common.api

import de.sluit.mediatracker.common.domain.Patch
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.nullable
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * Wire representation of an optional field in a PATCH body: the key is absent (leave unchanged), `null`
 * (clear the field) or a value (set it). Use it on request DTOs as
 * `@Serializable(with = PatchFieldSerializer::class) val x: PatchField<String> = PatchField.Absent`
 * and convert to the domain [Patch] with [toPatch].
 */
sealed interface PatchField<out T> {
    data object Absent : PatchField<Nothing>

    data class Present<T>(val value: T?) : PatchField<T>
}

fun <T, R> PatchField<T>.toPatch(convert: (T) -> R): Patch<R> = when (this) {
    PatchField.Absent -> Patch.Unchanged
    is PatchField.Present -> Patch.Change(value?.let(convert))
}

/**
 * The descriptor is nullable so that the JSON `null` token reaches [deserialize] (as a "not-null mark"
 * miss) instead of being rejected up front. An absent key never reaches the serializer at all; the property
 * default ([PatchField.Absent]) applies.
 */
class PatchFieldSerializer<T>(private val inner: KSerializer<T>) : KSerializer<PatchField<T>> {
    override val descriptor: SerialDescriptor = inner.descriptor.nullable

    override fun deserialize(decoder: Decoder): PatchField<T> = if (decoder.decodeNotNullMark()) {
        PatchField.Present(decoder.decodeSerializableValue(inner))
    } else {
        decoder.decodeNull()
        PatchField.Present(null)
    }

    override fun serialize(encoder: Encoder, value: PatchField<T>) {
        when (value) {
            PatchField.Absent -> throw SerializationException("PatchField.Absent must be omitted, not encoded")

            is PatchField.Present -> {
                val v = value.value
                if (v == null) encoder.encodeNull() else encoder.encodeSerializableValue(inner, v)
            }
        }
    }
}
