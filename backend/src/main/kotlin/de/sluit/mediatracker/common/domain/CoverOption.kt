package de.sluit.mediatracker.common.domain

/**
 * One selectable cover image, in both a thumbnail and its full-size form. [width] and [height] are `null` when the
 * source does not report image sizes.
 */
data class CoverOption(val thumbnailUrl: CoverImageUrl, val imageUrl: CoverImageUrl, val width: Int?, val height: Int?)
