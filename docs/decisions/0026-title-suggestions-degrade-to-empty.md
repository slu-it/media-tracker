# 0026: Title suggestions from SteamGridDB degrade to an empty list

Status: accepted, 2026-09

## Context

Titles in the add and edit forms are typed by hand. The spelling drifts from the official name, and the release
year has to be looked up separately. The SteamGridDB search the cover picker already uses (record 0024,
`CoverSource.searchGames`) returns, for each match, the name, an optional release date, the id and a verified
flag. That is enough to suggest the title while typing and to fill in the year.

The cover picker treats a missing or failing SteamGridDB as an error the user should see: `503
cover_source_unavailable` without a key, `502 cover_source_error` when the provider fails, each shown in the
picker dialog. A suggestion list is different. It pops up unasked while someone types, and the form works just
as well without it.

## Decision

- **`GET /api/games/title-suggestions?query=<term>`** sits next to `/cover-options` (session-authenticated,
  independent of any stored game). It returns `{ suggestions: CoverMatchResponse[] }` in SteamGridDB's order,
  at most 8. A missing or blank `query` is still a 400, since that is a client bug, not a provider state.
- **An unavailable or failing source yields an empty list, not an error.** `CoverOptionsService.suggestTitles`
  returns `[]` when no key is configured and when the adapter throws `ExternalSourceException`, which it logs at
  warn. The frontend renders nothing for an empty list, so a missing key, a SteamGridDB outage or a 429 is
  invisible in the form. The operator still sees the failures in the log.
- **The 5-character minimum and the 500 ms debounce are frontend UX rules**, not an API contract. The form
  sends the first request only after the user has edited the title, so opening an edit dialog costs no
  upstream call.
- **A picked suggestion sets the title and, if the match has one, overwrites the year.** A match without a
  year leaves the year field alone. Platforms are not derived: SteamGridDB's `types` name stores (Steam, GOG,
  ...), not the tracker's platforms.

## Alternatives not taken

- **Reusing `/cover-options`**: it also fetches a page of covers for the best match, one wasted upstream call
  per keystroke pause, and it reports failures as 502/503, which the form would have to swallow client-side.
- **Returning 503/502 and letting the SPA ignore them**: every consumer would repeat that rule. With no key
  configured, the browser console would also log a failed request on every pause while typing.

## Consequences

- `CoverOptionsService` now has two failure policies: `find` and `findFirstCover` throw, `suggestTitles`
  degrades. The KDoc on `suggestTitles` points here.
- Each typing pause that crosses the threshold costs one SteamGridDB search. SteamGridDB's rate limits remain
  undocumented (record 0024). A 429 would only make the suggestions disappear for a while.
