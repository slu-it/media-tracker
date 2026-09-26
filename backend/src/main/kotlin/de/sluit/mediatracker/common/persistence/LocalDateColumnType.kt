package de.sluit.mediatracker.common.persistence

import org.jetbrains.exposed.v1.core.ColumnType
import org.jetbrains.exposed.v1.core.IDateColumnType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.statements.api.RowApi
import org.jetbrains.exposed.v1.core.vendors.currentDialect
import java.time.LocalDate

/**
 * A `DATE` column bound straight through JDBC 4.2's `java.time.LocalDate` mapping (MT-025, ADR 0029), with no
 * epoch-millis or timezone conversion anywhere in the path.
 *
 * Exposed's own [org.jetbrains.exposed.v1.datetime.date] rounds every value through
 * `TimeZone.currentSystemDefault()`: writing converts the calendar date to "local midnight" in that zone and
 * hands the driver the resulting epoch-millis `java.sql.Date`; reading converts the epoch-millis the driver
 * returns back to a calendar date the same way. Every JDBC URL in this project pins the connection's own
 * session timezone to UTC (`timezone=UTC`, see `local-env.sh` / `TestDatabase.kt`), so on a JVM whose *default*
 * timezone is not UTC (e.g. a Raspberry Pi set to `Europe/Berlin`) the two disagree by the zone's offset and a
 * plain calendar date round-trips a day off. This type sidesteps both the instant and the timezone entirely: it
 * hands `java.time.LocalDate` itself to `PreparedStatement.setObject` ([notNullValueToDB], through the driver's
 * plain JDBC 4.2 date/time mapping) and reads it back with `ResultSet.getObject(index, LocalDate::class.java)`
 * ([readObject]), so the round-tripped calendar day never depends on any zone at all.
 */
class LocalDateColumnType :
    ColumnType<LocalDate>(),
    IDateColumnType {
    override val hasTimePart: Boolean = false

    override fun sqlType(): String = currentDialect.dataTypeProvider.dateType()

    override fun notNullValueToDB(value: LocalDate): Any = value

    override fun nonNullValueToString(value: LocalDate): String = "'$value'"

    override fun valueFromDB(value: Any): LocalDate = when (value) {
        is LocalDate -> value
        is java.sql.Date -> value.toLocalDate()
        is String -> LocalDate.parse(value)
        else -> LocalDate.parse(value.toString())
    }

    override fun readObject(rs: RowApi, index: Int): Any? = rs.getObject(index, LocalDate::class.java)
}

/** Like [org.jetbrains.exposed.v1.datetime.date], but bound straight through java.time; see [LocalDateColumnType]. */
fun Table.localDate(name: String) = registerColumn<LocalDate>(name, LocalDateColumnType())
