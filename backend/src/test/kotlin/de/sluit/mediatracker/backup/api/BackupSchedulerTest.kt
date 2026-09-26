package de.sluit.mediatracker.backup.api

import de.sluit.mediatracker.backup.domain.CloudBackupService
import de.sluit.mediatracker.common.domain.ExternalSourceUnavailableException
import de.sluit.mediatracker.common.domain.StoredFile
import de.sluit.mediatracker.config.BackupConfig
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant as KotlinInstant

private val BERLIN = ZoneId.of("Europe/Berlin")
private val UTC = ZoneId.of("UTC")

@OptIn(ExperimentalCoroutinesApi::class)
class BackupSchedulerTest {

    // ---- nextRun ----

    @Test
    fun `nextRun returns today's slot when it has not passed yet`() {
        val now = ZonedDateTime.of(2026, 1, 10, 1, 0, 0, 0, BERLIN)

        val next = nextRun(now, LocalTime.of(3, 0))

        assertEquals(ZonedDateTime.of(2026, 1, 10, 3, 0, 0, 0, BERLIN), next)
    }

    @Test
    fun `nextRun returns tomorrow's slot when now is exactly at the slot`() {
        val now = ZonedDateTime.of(2026, 1, 10, 3, 0, 0, 0, BERLIN)

        val next = nextRun(now, LocalTime.of(3, 0))

        assertEquals(ZonedDateTime.of(2026, 1, 11, 3, 0, 0, 0, BERLIN), next)
    }

    @Test
    fun `nextRun returns tomorrow's slot when the slot has already passed`() {
        val now = ZonedDateTime.of(2026, 1, 10, 4, 0, 0, 0, BERLIN)

        val next = nextRun(now, LocalTime.of(3, 0))

        assertEquals(ZonedDateTime.of(2026, 1, 11, 3, 0, 0, 0, BERLIN), next)
    }

    @Test
    fun `nextRun moves a slot skipped by the spring forward gap later by the gap length`() {
        // Europe/Berlin jumps from 2026-03-29T02:00 straight to 03:00, so 02:30 never exists that day.
        val now = ZonedDateTime.of(2026, 3, 29, 1, 0, 0, 0, BERLIN)

        val next = nextRun(now, LocalTime.of(2, 30))

        assertEquals(LocalDateTime.of(2026, 3, 29, 3, 30), next.toLocalDateTime())
        assertEquals(ZoneOffset.ofHours(2), next.offset)
    }

    @Test
    fun `nextRun resolves an ambiguous fall back slot to the earlier offset`() {
        // Europe/Berlin repeats 2026-10-25T02:00-03:00 local time, once at +02:00, once at +01:00.
        val now = ZonedDateTime.of(2026, 10, 25, 1, 0, 0, 0, BERLIN)

        val next = nextRun(now, LocalTime.of(2, 30))

        assertEquals(LocalDateTime.of(2026, 10, 25, 2, 30), next.toLocalDateTime())
        assertEquals(ZoneOffset.ofHours(2), next.offset)
    }

    @Test
    fun `nextRun computes the day after spring forward fresh instead of carrying over the gap shift`() {
        // Bug: todaySlot.plusDays(1) would carry the gap-shifted 03:30 face value into 03-30, giving 03:30
        // instead of the configured 02:30 (which is a perfectly normal, gap-free time on 03-30).
        val now = ZonedDateTime.of(2026, 3, 29, 4, 0, 0, 0, BERLIN)

        val next = nextRun(now, LocalTime.of(2, 30))

        assertEquals(LocalDateTime.of(2026, 3, 30, 2, 30), next.toLocalDateTime())
        assertEquals(ZoneOffset.ofHours(2), next.offset)
    }

    // ---- run loop ----

    private val storedFile = StoredFile(
        path = CloudBackupService.BACKUP_PATH,
        modifiedAt = KotlinInstant.parse("2026-01-10T00:00:00Z"),
        sizeBytes = 42,
    )

    /** Reads java.time.Instant from a [TestCoroutineScheduler]'s virtual clock, so `delay()` inside production
     * code and the clock production code reads from advance together under [runTest]'s virtual time. [stepTo]
     * simulates an NTP step: an arbitrary jump forward or backward independent of the virtual time elapsed since,
     * as if the wall clock, unlike the monotonic clock backing `delay()`, was corrected. */
    private class SteppableClock(
        private val start: Instant,
        private val scheduler: TestCoroutineScheduler,
        private val zone: ZoneId,
        private var offsetMillis: Long = 0,
    ) : Clock() {
        override fun getZone(): ZoneId = zone

        override fun withZone(zone: ZoneId): Clock = SteppableClock(start, scheduler, zone, offsetMillis)

        override fun instant(): Instant = start.plusMillis(scheduler.currentTime).plusMillis(offsetMillis)

        fun stepTo(apparentNow: Instant) {
            offsetMillis = java.time.Duration.between(start.plusMillis(scheduler.currentTime), apparentNow).toMillis()
        }
    }

    private fun TestCoroutineScheduler.steppableClock() =
        SteppableClock(Instant.parse("2026-01-09T23:59:00Z"), this, UTC)

    private fun TestCoroutineScheduler.virtualClock(): Clock = steppableClock()

    @Test
    fun `a successful backup runs once per day`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns true
        coEvery { cloudBackup.backupNow() } returns storedFile
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        advanceTimeBy(24.hours)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }
    }

    @Test
    fun `a failed backup is retried once after an hour and succeeds`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns true
        coEvery { cloudBackup.backupNow() } throws RuntimeException("boom") andThen storedFile
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        advanceTimeBy(90.minutes)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }
    }

    @Test
    fun `a second failed retry waits for the next day instead of retrying again`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns true
        coEvery { cloudBackup.backupNow() } throws RuntimeException("boom") andThenThrows
            RuntimeException("boom again") andThen storedFile
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        advanceTimeBy(90.minutes)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }

        // Well short of the next day's slot: no third attempt yet.
        advanceTimeBy(20.hours)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }

        // Past the next day's slot: the normal schedule resumes.
        advanceTimeBy(4.hours)
        runCurrent()
        coVerify(exactly = 3) { cloudBackup.backupNow() }
    }

    @Test
    fun `isEnabled throwing once is retried after an hour and the next day's slot still runs`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } throws RuntimeException("db unreachable") andThen true
        coEvery { cloudBackup.backupNow() } returns storedFile
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 0) { cloudBackup.backupNow() }

        advanceTimeBy(90.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        advanceTimeBy(23.hours)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }
    }

    @Test
    fun `dropbox not being connected is skipped before exporting, without a retry`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns false
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 0) { cloudBackup.backupNow() }

        // No retry after an hour, unlike a real failure.
        advanceTimeBy(90.minutes)
        runCurrent()
        coVerify(exactly = 0) { cloudBackup.backupNow() }

        // The next day's slot is attempted (and, still not connected, skipped) normally, never exporting.
        advanceTimeBy(23.hours)
        runCurrent()
        coVerify(exactly = 0) { cloudBackup.backupNow() }
    }

    @Test
    fun `dropbox being revoked mid-run is skipped without a retry`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns true
        coEvery { cloudBackup.backupNow() } throws ExternalSourceUnavailableException("dropbox")
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        // No retry after an hour, unlike a real failure.
        advanceTimeBy(90.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        // The next day's slot is attempted normally.
        advanceTimeBy(23.hours)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }
    }

    @Test
    fun `cancelling the scheduler stops the loop`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.backupNow() } returns storedFile
        val scheduler =
            BackupScheduler(cloudBackup, BackupConfig(LocalTime.MIDNIGHT, UTC), testScheduler.virtualClock())
        val job = launch { scheduler.run() }

        job.cancel()
        job.join()

        assertTrue(job.isCancelled)
        advanceTimeBy(48.hours)
        runCurrent()
        coVerify(exactly = 0) { cloudBackup.backupNow() }
    }

    // ---- wall clock drift (no RTC, NTP steps the clock after boot) ----

    @Test
    fun `a wall clock jump forward past the next slot runs the backup only once, not once per skipped day`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns true
        coEvery { cloudBackup.backupNow() } returns storedFile
        val clock = testScheduler.steppableClock()
        val scheduler = BackupScheduler(
            cloudBackup,
            BackupConfig(LocalTime.MIDNIGHT, UTC),
            clock,
            maxSleepChunk = 10.minutes,
        )
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(2.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() } // the 2026-01-10T00:00 slot ran

        // NTP steps the wall clock forward by three days while the scheduler sleeps toward the next slot.
        clock.stepTo(Instant.parse("2026-01-13T00:05:00Z"))
        advanceTimeBy(15.minutes)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() } // only the slot it was waiting for, no catch-up storm
    }

    @Test
    fun `a clock correction landing on an already run slot right after it ran does not run it twice`() = runTest {
        val cloudBackup = mockk<CloudBackupService>()
        coEvery { cloudBackup.isEnabled() } returns true
        lateinit var clock: SteppableClock
        var corrected = false
        coEvery { cloudBackup.backupNow() } coAnswers {
            // Simulates the upload itself taking a moment, during which a one-off NTP correction lands the clock
            // just before the slot that is running right now.
            delay(1.minutes)
            if (!corrected) {
                corrected = true
                clock.stepTo(Instant.parse("2026-01-09T23:59:30Z"))
            }
            storedFile
        }
        clock = testScheduler.steppableClock()
        val scheduler = BackupScheduler(
            cloudBackup,
            BackupConfig(LocalTime.MIDNIGHT, UTC),
            clock,
            maxSleepChunk = 10.minutes,
        )
        backgroundScope.launch { scheduler.run() }

        advanceTimeBy(3.minutes)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() } // the 2026-01-10T00:00 slot ran once

        // The scheduler catches back up to the very slot it just ran; it must not fire it a second time.
        advanceTimeBy(2.hours)
        runCurrent()
        coVerify(exactly = 1) { cloudBackup.backupNow() }

        // Once real time reaches the following day's slot, the schedule resumes normally.
        advanceTimeBy(24.hours)
        runCurrent()
        coVerify(exactly = 2) { cloudBackup.backupNow() }
    }
}
