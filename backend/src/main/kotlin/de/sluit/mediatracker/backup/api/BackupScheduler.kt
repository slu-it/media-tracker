package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.backup.domain.CloudBackupService
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.config.BackupConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import org.slf4j.LoggerFactory
import java.time.Clock
import java.time.LocalTime
import java.time.ZonedDateTime
import kotlin.time.Duration
import kotlin.time.Duration.Companion.hours
import kotlin.time.toKotlinDuration

/**
 * Runs [CloudBackupService.backupNow] once a day at [BackupConfig.dailyAt]/[BackupConfig.zone] (MT-024, ADR
 * 0028). A driving adapter like `BackupRoutes.kt`, started in `Application.module()` with `launch { }` on the
 * `Application` scope, so it is cancelled with the application job (safe under auto-reload, like the shutdown
 * hooks in `Application.kt`).
 *
 * [run] never lets a failure kill the loop:
 * - Before exporting anything, [CloudBackupService.isEnabled] is checked; `false` (Dropbox not connected, or not
 *   configured) is logged at info and skipped with no DB export and no retry. This check runs inside the same
 *   error handling as the export itself, so an exception from its own DB lookup (e.g. MariaDB briefly
 *   unreachable at the slot) is treated like any other failed attempt below, not left to escape the scheduler.
 * - [ExternalSourceUnavailableException] out of an actual run (e.g. the connection is revoked mid-run, after
 *   [CloudBackupService.isEnabled] returned `true`) is logged at info the same way, with no retry.
 * - Any other exception, including one from [CloudBackupService.isEnabled] itself, is logged at error, then
 *   retried exactly once after [retryDelay]; a failure of that retry is logged again and the scheduler goes back
 *   to waiting for the next scheduled slot.
 *
 * Only [CancellationException] propagates, so the coroutine actually stops when the application is shut down.
 *
 * A Raspberry Pi without an RTC can have its wall clock stepped by NTP after boot, so [run] never sleeps the full
 * (up to 24 h) delay in one [delay] call on [clock]'s wall time: [sleepUntilClock] re-reads [clock] after every
 * chunk of at most [maxSleepChunk] and keeps sleeping until the target has actually passed. [lastRunSlot] then
 * guards against running the same slot twice if a backward step makes the clock re-cross a slot it already ran.
 */
class BackupScheduler(
    private val cloudBackup: CloudBackupService,
    private val config: BackupConfig,
    private val clock: Clock,
    private val retryDelay: Duration = 1.hours,
    private val maxSleepChunk: Duration = 1.hours,
) {
    private val log = LoggerFactory.getLogger(BackupScheduler::class.java)
    private var lastRunSlot: ZonedDateTime? = null

    suspend fun run() {
        while (true) {
            val next = nextRun(ZonedDateTime.now(clock), config.dailyAt)
            sleepUntilClock(next)
            if (next == lastRunSlot) {
                log.info("slot $next already ran, skipping a duplicate wake-up (clock moved backward)")
            } else {
                lastRunSlot = next
                runOnce()
            }
        }
    }

    /** Sleeps until [clock] reaches [target], re-reading [clock] after every chunk instead of trusting one
     * up-front delay computed on possibly stale wall-clock time. */
    private suspend fun sleepUntilClock(target: ZonedDateTime) {
        while (true) {
            val remaining = java.time.Duration.between(ZonedDateTime.now(clock), target).toKotlinDuration()
            if (remaining <= Duration.ZERO) return
            delay(minOf(remaining, maxSleepChunk))
        }
    }

    private suspend fun runOnce() {
        if (attemptBackup() != AttemptResult.FAILED) return
        delay(retryDelay)
        if (attemptBackup() == AttemptResult.FAILED) {
            log.error("retry of the scheduled dropbox backup failed, trying again at the next scheduled time")
        }
    }

    private enum class AttemptResult { SUCCEEDED, SKIPPED, FAILED }

    private suspend fun attemptBackup(): AttemptResult = try {
        if (!cloudBackup.isEnabled()) {
            log.info("Dropbox not connected, skipping the scheduled backup")
            return AttemptResult.SKIPPED
        }
        val stored = cloudBackup.backupNow()
        log.info("scheduled dropbox backup uploaded to ${stored.path} (${stored.sizeBytes} bytes)")
        AttemptResult.SUCCEEDED
    } catch (e: CancellationException) {
        throw e
    } catch (e: ExternalSourceUnavailableException) {
        log.info("Dropbox not connected, skipping the scheduled backup")
        AttemptResult.SKIPPED
    } catch (e: Exception) {
        log.error("scheduled dropbox backup failed", e)
        AttemptResult.FAILED
    }
}

/**
 * The next point in time [at] should run, given it is currently [now]: today's slot if it has not passed yet,
 * otherwise tomorrow's. `ZonedDateTime.of(LocalDate, LocalTime, ZoneId)` already resolves DST correctly: a
 * spring-forward gap is pushed forward (Java's default `ZonedDateTime` resolution), and a fall-back overlap picks
 * the earlier offset. Tomorrow's slot is built fresh from `now`'s date plus one day, not by adding a day to
 * `todaySlot`: if `todaySlot` itself got pushed forward by a spring-forward gap, its local time no longer reads
 * [at], and adding a day would carry that shift into a day with no gap at all.
 */
fun nextRun(now: ZonedDateTime, at: LocalTime): ZonedDateTime {
    val todaySlot = ZonedDateTime.of(now.toLocalDate(), at, now.zone)
    return if (todaySlot.isAfter(now)) todaySlot else ZonedDateTime.of(now.toLocalDate().plusDays(1), at, now.zone)
}
