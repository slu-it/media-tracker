package de.sluit.mediatracker.auth

import de.sluit.mediatracker.auth.persistence.ExposedUserRepository

/**
 * Creates a user through [ExposedUserRepository.createBlocking] (no real password hash needed for
 * repository tests). Must be called inside a `transaction { }` since `createBlocking` is a blocking,
 * non-suspending call.
 */
fun insertUser(username: String = "alice", hash: String = "not-a-real-hash"): Long =
    ExposedUserRepository().createBlocking(username, hash)
