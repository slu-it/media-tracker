# 0022: A `hasMissing` filter for incomplete games, and a page size for `search_games`

Status: accepted, 2026-09

## Context

Record 0021 gave the game list four filters and taught `search_games` to use them, so an agent can ask "what am I
playing on the Switch". It cannot ask the question that makes an agent useful as a librarian: *which of my games
are still missing information?* A game carries two optional free-text properties worth completing - the
`description` and the `coverImageUrl` - and nothing in the API can select the games where they are absent.

Two things were in the way. There was no filter for "this property has no value", and `search_games` hard-coded
`PageSize(10)`, so a sweep over a collection was capped at ten games per call with no way to ask for more. Both
are agent problems: the frontend has no screen that wants either.

## Decision

- **`hasMissing` is a fifth category on `GameFilters`,** not a new repository method and not a variant of
  `?search=`. It inherits everything record 0021 already decided: it takes the `search` branch through
  `isEmpty`, it lands in the same `compoundAnd()` as the other four, and it works unchanged with a fulltext term
  next to it.
- **It ORs its own values, like every other category.** `hasMissing: ["description", "coverImageUrl"]` means
  "either is missing", which is what "find me the incomplete games" asks for; AND would have forced an agent
  wanting "either" into two calls and a merge. The categories still AND with each other, so `hasMissing` next to
  `ownership` reads as "owned games that are incomplete".
- **`IS NULL` is the whole test.** `Description` forbids a blank value, so a stored description is never an empty
  string and there is no second "missing" state to think about.
- **No migration and no index.** A nullability check on a personal collection of this size does not justify one,
  and `description` is `TEXT`, which MariaDB cannot index without a prefix length. This is the first filter story
  that is a pure code change; it is deliberately not a two-file schema commit.
- **The filter is MCP-only for now.** `GameFilterParams.kt` does not parse a `?hasMissing=`, so `GET /api/games`
  and `GET /api/games.meta` are untouched. The domain type carries the category regardless, so exposing it over
  REST later is a line in the parser and a handler test, not a redesign. It also stays out of `.meta`: unlike a
  platform or a year, the two field names are a closed set known at compile time, and a client needs no lookup
  call to learn them.
- **The wire values are the DTO field names** (`description`, `coverImageUrl`), not the `name.lowercase()` that
  record 0017 established for `ownership` and `progress`. Those enums name *values* of a field; this one names
  *fields*, and the useful spelling is the one the agent just read as `null` in a game object. `MissingField`
  therefore carries an explicit `wire` instead of deriving it, and the divergence is the point rather than an
  oversight.
- **`search_games` takes an optional `pageSize`, default 10, maximum 100.** The default is what the tool did
  before, so no existing caller changes. 100 is a deliberate ceiling below `PageSize`'s own 200: a tool result is
  prose in someone's context window, and a hundred games is already a long message. The check runs before
  `PageSize` is constructed, so the error an agent gets names the tool's limit rather than the domain's.
- **The result stays unpaged and says when it is truncated.** No `page` argument, no paging envelope; the
  structured content keeps `totalMatches` and gains `truncated`, and the summary text keeps saying "N of M
  matches". An agent needs to know that it has not seen everything far more than it needs to fetch page four,
  and "raise `pageSize`" is a better next move for it than a cursor.

## Alternatives not taken

- A `hasMissing` value per property with an `AND` reading, or a general `where description IS NULL` style
  expression language: the first is the same filter with a worse default, the second is a query language nobody
  asked for on a list of a few hundred rows.
- Including `rating` in the vocabulary: it is optional too, but an absent rating is a judgement the owner has not
  made yet, not missing data an agent could go and fetch. Adding it later is one enum entry and one `when` branch.
- A `hidden`-style boolean `incompleteOnly`: shorter to type, but it fixes the set of properties into the
  parameter name and cannot grow.
- Paging the tool properly (`page` + `pageSize` + a paging envelope): more API surface for an agent to get wrong,
  and the honest fix for "too many results" at this scale is a narrower filter, not a second page.
- Letting `pageSize` go to `PageSize.MAX` (200): the domain's limit exists to protect the database, the tool's to
  protect the conversation. They are different concerns and deserve different numbers.

## Consequences

- `MissingField`'s `when` in `ExposedGameRepository.missingOp` is exhaustive with no `else`, so adding a property
  to the enum fails the build until the SQL for it exists. That coupling is intentional.
- The next media kind gets this for free in shape: a `missing` set on its `<Kind>Filters` and one `when` over its
  own optional columns.
- `search_games` is now the tool an agent uses to *audit* a collection, not only to look one game up. Paired with
  `update_game` from record 0013 it closes a loop: find the games without a description, write one, verify.
- A `hasMissing` call with no `query` is legal, because the filter makes `GameFilters.isEmpty` false. The "provide
  a query or at least one filter" guard from record 0021 needed no change.
