# 0023: Game expansions as a nested sub-resource, with an owner-defined order

Status: accepted, 2026-09

## Context

Games have DLC. Until now a game was a flat record, so someone tracking "Hades plus its two add-ons" had to
invent three games or drop the information. An expansion is not a media kind of its own: it has no year, no
platforms, no cover and no rating, it is never listed on its own, and it cannot outlive its game. What it does
have is a title, the same `ownership` and `progress` the game has, and a position in a list that the owner
arranges by hand.

That last part is the interesting one. Every other ordering in this application is derived - games by title, by
relevance, filter values by enum declaration order (record 0021) - and derived orders need no storage. A manual
order does.

## Decision

- **Expansions live in the `games` domain**, in the same `{api,domain,persistence}` packages (record 0007). They
  are a second aggregate inside one domain, not a fifth top-level package next to books, movies and series: the
  onion layering is per domain, and an expansion has no meaning without its game.
- **`Title`, `Ownership` and `Progress` are reused verbatim** from the game. The requirement was "the same
  limits", and the honest way to spell that is the same type, not a copy with the same numbers in it.
- **The URL nests: `/api/games/{id}/expansions[/{expansionId}]`.** The child is addressed through its parent
  because it only exists through its parent; an unknown game is a 404 on every one of the four routes, and an
  expansion id that belongs to a different game is a 404 too, not a silent success. The route sits inside the
  existing `route("/{id}")` block, so the parent's id parser is reused rather than duplicated under a second
  parameter name. `DELETE` is the exception on both counts: like `DELETE /api/games/{id}` it is idempotent, so a
  game or an expansion that is not there is a 204, not a 404.
- **`ON DELETE CASCADE` on the foreign key.** "Delete the game, delete its expansions" is a database guarantee,
  not something the service remembers to do - the same choice `game_to_platform` made in V002.
- **The sequence is dense and zero-based per game (`0..n-1`), and the service owns that invariant.** Reading is
  then just `ORDER BY sequence, id`, and the frontend can use a row's index as its sequence without a
  translation step. Create appends, delete re-packs, a move renumbers. The `id` tiebreak costs nothing and means
  the order never depends on which of two equal sequences the database happens to return first.
- **There is deliberately no `UNIQUE (game_id, sequence)`.** Renumbering rewrites several rows, and the
  workarounds for doing that under a unique constraint (a temporary offset pass, or deferred constraints
  MariaDB does not have) buy nothing: the service is the only writer, and a repository test pins that the order
  survives a round trip. Density is a domain invariant, not a database one.
  Precisely: `saveOrder` renumbers the whole list in one transaction, but a *move* is an update followed by a
  `saveOrder` and a *delete* is a delete followed by one, so those operations span more than one transaction and
  a crash between them can leave a duplicate or a gap. That is survivable rather than guarded against, because
  the anomaly is transient - the next move or delete re-packs the entire range - and because the listing orders
  by `(sequence, id)`, so even a duplicated sequence still yields one deterministic order rather than a list
  that shuffles between reads. At the size of a personal collection, with one writer, that trade is worth more
  than a constraint the ordinary path would have to dance around.
- **Reordering is a `PATCH` of the moved expansion** with its new `sequence`; the server removes it from its old
  index, inserts it at the new one and renumbers the rest. The alternatives were a dedicated
  `PUT .../expansions/order` taking the whole id list, which is atomic and explicit but adds a fifth route and a
  second way to write the same rows, and letting the client compute every affected sequence number, which turns
  one drop into N requests that can half-fail. A sequence outside the current range is a 400, not a clamp: an
  agent or a client that computes an index wrongly should hear about it.
- **No field of an expansion is clearable,** so `UpdateExpansionRequest` uses plain nullable fields instead of
  `PatchField`. `PatchField`'s three-way absent/null/value distinction earns its keep only where `null` means
  "clear it" (`description`, `rating`, `coverImageUrl` on a game); here `null` can simply mean "unchanged".
- **The detail dialog fetches the expansions when it opens.** Embedding them in `GameResponse` would have made
  every page of the grid carry data that only one dialog uses, for 36 games at a time.
- **@dnd-kit (`core` + `sortable`) is the drag-and-drop library.** It is small, dependency-free and, decisively,
  ships a keyboard sensor: the reorder is reachable without a mouse and, because the keyboard path dispatches
  ordinary key events, it is the one part of dragging that jsdom can actually run.
- **MCP gets `list_expansions` and `add_expansion`,** so the agent that can already find a game and fill its
  description can also record its DLC. `update_expansion` and `delete_expansion` are deferred until something
  asks for them; reordering in particular is a UI gesture, not an agent one.

## Alternatives not taken

- An `expansions` media kind of its own, with its own package, list view and filters: an expansion has no life
  outside its game, and the four-package symmetry would have been the only argument for it.
- A self-referencing `parent_game_id` on `games`: it would have given expansions years, platforms, covers and
  ratings they do not have, and every list query would have needed a "only real games" predicate forever after.
- A fractional or gapped sequence (1000, 2000, 3000...) so a move writes exactly one row: cheaper per move, but
  it leaks a storage trick into the API, and at the size of a personal game collection renumbering a handful of
  rows costs nothing.
- Storing the order as a list of ids on the game (a JSON column): one write per move, but it puts the ordering
  outside the rows it orders, where nothing keeps it in sync with an insert or a cascade delete.

## Consequences

- `GameRepository` gained `exists(id)`. A nested resource has to answer "is the parent real?" on every call, and
  loading a whole game with its platforms to find out would have been wasteful.
- The next media kind that needs children copies this shape: a child table with a cascading FK and a `sequence`,
  a service that owns density, and routes nested under the parent's id.
- The keyboard sensor is what the tests drive, and it does run under jsdom: focus the handle, space, arrow,
  space, and the resulting `PATCH` body is asserted. Two things had to be true for that. `test-setup.ts` stubs
  `Element.prototype.scrollIntoView`, which jsdom does not implement and which the sensor calls whenever the
  dragged element sits inside a scrollable ancestor - inside a dialog, always, because jsdom's zero-size rects
  make everything look out of view. And the handle must be focused inside `act()`, or MUI's `ButtonBase` sets
  its focus-visible state outside React's knowledge and the `console.error` guard fails the test.
  The honest limit: with zero-size rects the sensor's directional filtering has nothing real to compare, so a
  two-item list resolves unambiguously while longer lists may pick a different candidate than a browser would.
  The tests therefore pin the wiring and the request, not the geometry. Pointer dragging is not covered at all
  and is verified by eye, the way the frozen dialog layout already is (record 0012).
- The frontend has its first runtime dependency beyond React, MUI and i18next. The version policy applies
  unchanged: exact pins, current majors.
