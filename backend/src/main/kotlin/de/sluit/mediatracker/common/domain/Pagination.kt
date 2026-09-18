package de.sluit.mediatracker.common.domain

/** 1-based page number as used on the API (`?page=`). */
@JvmInline
value class PageNumber(val value: Int) {
    init {
        requireValid(FIELD, value >= 1) { "must be at least 1" }
    }

    companion object {
        const val FIELD = "page"
        val FIRST = PageNumber(1)
    }
}

/** Number of items per page (`?pageSize=`). */
@JvmInline
value class PageSize(val value: Int) {
    init {
        requireValid(FIELD, value in 1..MAX) { "must be between 1 and $MAX" }
    }

    companion object {
        const val FIELD = "pageSize"
        const val MAX = 200
        val DEFAULT = PageSize(50)
    }
}

data class PageRequest(val page: PageNumber = PageNumber.FIRST, val size: PageSize = PageSize.DEFAULT) {
    /** Row offset of the first item on this page. */
    val offset: Long get() = (page.value - 1L) * size.value
}

/** One page of results plus the totals the client needs to render pagination controls. */
data class Page<T>(val items: List<T>, val page: PageNumber, val size: PageSize, val totalItems: Long) {
    /** 0 when there are no items at all. */
    val totalPages: Int get() = ((totalItems + size.value - 1) / size.value).toInt()

    fun <R> map(transform: (T) -> R): Page<R> = Page(items.map(transform), page, size, totalItems)
}
