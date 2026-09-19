# 0009: Game platforms as a seeded reference table, not an enum

Status: accepted, 2026-09

## Context

MT-001 started with a hard-coded `Platform` enum (PC, PlayStation, Xbox, Nintendo) stored as a constant name in
`games.platform`, and one platform per game. Testing showed two gaps: a game is often owned on several platforms,
and the set of platforms (and how they are shown) should be data the owner can extend later through an admin
screen, not a code change. At the same time MT-001 gained an optional free-text description and a quarter-step
star rating. The feature branch is unmerged and the only database with the games schema was wiped, so the schema
could still be amended in place.

## Decision

- **Platforms are rows** in `game_platforms` (`id CHAR(36)`, unique `label`, `associated_color` as a six-character
  `RRGGBB` hex string). The four former enum constants are seeded by the migration itself with fixed UUIDs, so
  tests and fixtures can refer to them and every environment starts with the same ids. Colours live in the
  database as well (Xbox green, PlayStation blue, Nintendo red, PC grey) so the frontend paints platform chips
  from data instead of a name-to-colour map.
- **Many-to-many** through `game_to_platform` (`game_id`, `platform_id`, composite primary key, both columns
  indexed, `ON DELETE CASCADE` from the game side). A game must have at least one platform; that rule lives in
  the domain, not in the schema. Platforms are loaded for a page of games with one extra query, never per game.
- **Read-only API for now**: `GET /api/game-platforms` lists the rows; games are created and patched with
  `platformIds` and returned with the embedded `platforms` (id, label, colour). An admin UI for platforms is a
  later story.
- **Description and rating** are nullable columns on `games`: `description` (at most 10000 characters, enforced
  by the `Description` value class) and `rating` as a `DOUBLE` (0.25 to 5 in steps of 0.25, enforced by the
  `Rating` value class; quarter steps are exact in binary floating point).
- **`V002__games.sql` was amended in place** instead of adding `V003`, because MT-001 had never been applied to a
  database that survives. This is a one-off exception documented in the script; from the first release on, the
  "never edit an applied script" rule in `CLAUDE.md` applies without exception.

## Alternatives not taken

- Keep the enum and add a `platforms` JSON or comma-separated column: no referential integrity, no place for
  labels or colours, and still a code change per new platform.
- A per-platform colour map in the frontend keyed by label: breaks as soon as a platform is renamed or added.
- `DECIMAL(3,2)` for the rating: exact as well, but the app-level type would be `BigDecimal`; the owner asked
  for a floating point number and the allowed values are all exactly representable as `DOUBLE`.
- A new `V003` migration: correct in general, but it would carry a pointless `ALTER TABLE`/data-move for a table that
  never held production data.

## Consequences

- Other media kinds that need reference data (book genres, streaming services, ...) copy this pattern: a seeded
  `<kind>_<things>` table, a junction table, and a small read-only list endpoint.
- Platform labels are no longer translated or hard-coded in the frontend; `PLATFORMS`/`PLATFORM_LABELS` are gone.
- The frontend fetches `/api/game-platforms` once per games view and passes the list down to the form field.
