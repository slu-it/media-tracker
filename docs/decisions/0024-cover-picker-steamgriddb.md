# 0024: Cover image picker backed by SteamGridDB, through a backend adapter

Status: accepted, 2026-09

## Context

Finding a cover image was the slowest step of maintaining the collection. The routine was: search GameFAQs or
Wikipedia for the game, browse the box shots, open the full-size one, copy its address, paste it into the edit
dialog. Every step is manual, and the sites make the navigation hard to shortcut: a GameFAQs box-shot URL
encodes a platform slug and an unguessable numeric id.

Automating that path is not possible. GameFAQs puts both its pages and its image files behind a Cloudflare
managed challenge, so any non-browser client - the Pi included - gets a 403, and a browser `fetch` from the
tracker's origin is stopped by CORS. MobyGames, the closest thing to a box-shot API (covers per platform and
region, with thumbnails), has been paid-only since 2024. What is free and has an API key: IGDB (one canonical
cover per entry, via a Twitch developer app), TheGamesDB (front and back box art, monthly quota), Wikipedia
(infobox image, low resolution, no key) and SteamGridDB, whose community-made 600x900 "grids" are exactly the
clean poster-style covers this collection uses.

The wanted flow: open a game, click its cover (empty or not), see thumbnails, click one, done.

## Decision

- **SteamGridDB is the one provider, behind a backend endpoint.** The API key must not reach the browser, so
  the backend does the calls: `GET /api/games/{id}/cover-options` nested in the game's `/{id}` block like the
  expansions (record 0023). The picker is reachable from the detail dialog by clicking the cover, whether it is
  still the empty placeholder or an image that should be replaced; the edit form's URL field stays for pasting a
  link by hand.
- **Cover URLs stay external.** The picked image's CDN URL goes into `coverImageUrl`, nothing is downloaded or
  stored. That is the model the field has always had, and every cover so far is a hotlink anyway. Storing
  images on the Pi would be a decision of its own (blob column or volume, serving route, migration of the
  existing links) and is left for the day a hotlink actually rots.
- **Ambiguity is resolved by ranking plus a user override, not by fetching everything.** The endpoint returns
  every SteamGridDB game matching the search term (`matches`), the id the domain ranking picked
  (`selectedMatchId`), and covers **only for that one**. The ranking is a pure function: normalise (trim,
  lowercase, collapse whitespace), an exact title match wins, among exact matches the same release year, then
  the first; without an exact match the first result; no results means `null` and no covers. `?match=<id>`
  fetches covers for another candidate (ranking skipped, `matches` still returned so the dropdown stays
  populated), `?query=<term>` replaces the search term, which defaults to the game's title. The alternative,
  covers for every match grouped in one response, is N+1 upstream calls per click against an undocumented rate
  limit, for candidates the owner will mostly never look at, and the UI would show one group at a time anyway.
- **The key is optional, and the endpoint says so with a 503.** Without `STEAMGRIDDB_API_KEY` the service is
  wired with no source and answers `503 cover_source_unavailable`; the picker shows a message naming the
  variable. Development, CI and the tests run without a key. The alternative was a capability flag on `/api/me`
  or `/api/games.meta` so the placeholder is only clickable when configured, but the SPA deliberately does not
  call `/api/me` at startup, `.meta` is filter lookup data, and a flag is a second code path to keep in sync. A
  single owner clicking once and reading "not configured" is the cheaper failure.
- **Outbound adapters get a fourth onion layer, `integration`.** `CoverSource` is a port in `games/domain`
  (`searchGames(term)`, `findCovers(id)`), `CoverOptionsService` orchestrates repository, ranking and port, and
  `games/integration/SteamGridDbCoverSource` is the only class that knows SteamGridDB's URLs and JSON. The
  dependency direction is `integration -> domain` (plus `config`, for its own settings), exactly like
  `persistence` (record 0007); `api` and the frontend see only the service and the DTOs, so a second provider is
  a second port implementation and one line in `module()`. Persistence was not stretched to cover it: an HTTP client is not a repository, and the
  package name should say what the code talks to.
- **Failures of the source are their own exception types in `common/domain`,** because `plugins/StatusPages.kt`
  may not import a feature. `ExternalSourceUnavailableException(source)` maps to `503 <source>_unavailable`,
  `ExternalSourceException(source, ...)` to `502 <source>_error`, logged at warn; the upstream body is never
  echoed. With `source = "cover_source"` the codes read `cover_source_unavailable` and `cover_source_error`,
  and a later provider for another media kind reuses the mapping without touching the plugin.
- **Ktor client with the Java engine.** `ktor-client-java` sits on the JDK's `HttpClient`: no second TLS stack,
  the JDK trust store the distroless image already has, standard proxy properties. CIO would have been a
  hand-rolled TLS stack for one outbound call. The client is created only when a key is configured and closed
  from the application's coroutine job, the same rule the database follows under auto-reload. Ten-second request
  timeout, `expectSuccess = false` so status codes are handled explicitly, `ignoreUnknownKeys` so SteamGridDB can
  add fields.
- **Grids are requested as `600x900,660x930`, static, no NSFW, no humor.** Those are the two portrait sizes;
  animated, joke and adult grids are not covers for this collection. The thumbnail SteamGridDB serves next to
  each grid is what the picker shows, the full grid URL is what gets saved.

## Alternatives not taken

- Scraping GameFAQs from the backend or the browser: blocked as described above. A userscript on GameFAQs that
  pushes the picked URL into the tracker through the API key would work, but it is a moving part outside the
  repository that depends on somebody else's markup.
- A drop or paste target on the cover, so a box shot dragged from another tab lands in the tracker: cheap and
  provider-independent, still an option later, but it does not remove the searching and browsing.
- IGDB alongside SteamGridDB from the start: the port allows it, the need has not shown up.
- Downloading the picked image: see above.

## Consequences

- One smoke test asserts the 503 of the unconfigured path against the real module. That is not a happy path,
  which record 0011 reserves smoke tests for, but it is the documented behaviour of the wired application in
  every environment the tests can reach; the configured path can only be verified by hand against SteamGridDB.
  The adapter is tested with Ktor's `MockEngine` instead, at the level a repository test would occupy.
- `Services`, `gameRoutes` and `handlerApp` gained a `coverOptions` parameter.
- The `MissingField` filter of record 0022 already lets an agent find games without a cover; an MCP tool that
  returns cover options (`find_cover_options`) would complete that loop and is deferred until asked for.
- SteamGridDB's rate limits are undocumented. The 500 ms debounce on the search field plus two upstream calls
  per query keeps the traffic small; a 429 surfaces as `502 cover_source_error` like any other upstream failure.
